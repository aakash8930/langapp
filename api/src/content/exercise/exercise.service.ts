import { BadRequestException, Inject, Injectable, Logger, UnprocessableEntityException, forwardRef } from '@nestjs/common';
import { Types } from 'mongoose';
import { ContentService } from '../content.service';
import { decomposeIntoKana } from '../../common/kana/decompose';
import {
  AnswerResult,
  ExerciseSet,
  GeneratedQuestion,
  toPublicQuestion,
} from '../dto/exercise-response.dto';
import { LessonDetail, ResolvedItem } from '../dto/lesson-response.dto';
import { ExerciseAttemptsService } from '../../learning/exercise-attempts.service';
import { LearnerItemStateService } from '../../learning/learner-item-state.service';
import { LearningService } from '../../learning/learning.service';
import { mulberry32, seedFrom, shuffle } from './deterministic-random';
import { ExercisePluginRegistry } from './plugins/exercise-plugin.registry';
import {
  assembleOptions,
  Choice,
  GRAMMAR_QUESTION,
  isGrammar,
  isKana,
  isKanji,
  isVocab,
  KANA_QUESTION,
  KANJI_QUESTION,
  kanaChoice,
  KindQuestion,
  normaliseAnswer,
  promptKindToSrsKind,
  toGrammarChoice,
  toKanjiChoice,
  VOCAB_QUESTION,
  vocabChoice,
} from './question-builder';

const OPTION_BASED_TYPES = ['multipleChoice'];
const TYPING_TYPES = ['wordReading'];

/**
 * How a lesson's items become questions, per item kind. The shape of the
 * question (multipleChoice vs wordReading) is decided by `lesson.exerciseTypes`
 * — `style` is about the *content* (kana, vocab, grammar).
 *
 * `promptKind` and `question` come from `question-builder.ts`, which the unit
 * checkpoint shares; only the pool lookup is service-bound, because it is the
 * one part that reads the database.
 */
interface QuestionStyle extends KindQuestion {
  /** Every item of this kind in the unit — the distractor pool. */
  pool: (unit: string) => Promise<Choice[]>;
}

/**
 * Multiple choice: show something, offer four readings of it.
 *
 * Two kinds are answerable so far — a kana character asking for its romaji, and
 * a vocabulary word asking for its meaning. Both reduce to the same shape
 * (`Choice`), which is why adding the second cost a mapping rather than a
 * parallel code path. Grammar and kanji would slot in the same way.
 *
 * Nothing is persisted. Generation is a pure function of
 * (lessonId, userId, attempt) plus content, so answering re-derives the same
 * set and checks against it — which is what keeps the answer key out of the
 * response without needing a store or a TTL.
 */
@Injectable()
export class ExerciseService {
  private readonly logger = new Logger(ExerciseService.name);

  private readonly KANA_STYLE: QuestionStyle = {
    ...KANA_QUESTION,
    pool: async (unit) =>
      (await this.contentService.findUnitKanaPool(unit)).map((doc) => ({
        id: doc._id.toString(),
        prompt: doc.kana,
        answer: doc.romaji,
      })),
  };

  private readonly VOCAB_STYLE: QuestionStyle = {
    ...VOCAB_QUESTION,
    pool: async (unit) =>
      (await this.contentService.findUnitVocabPool(unit)).map((doc) => ({
        id: doc._id.toString(),
        prompt: doc.lemma,
        answer: doc.gloss,
      })),
  };

  /**
   * Kanji → English meaning, and deliberately *not* kanji → reading.
   *
   * A kanji has several readings and which one applies depends on the word it
   * sits in: 山 is やま alone and サン in 火山, and both are correct. "Which
   * reading is this kanji?" therefore has two right answers, the same defect the
   * grammar unit hit with 「わたしはいき＿。」 (see OPEN-ITEMS #26). The meaning is
   * the one thing a kanji has independently of context, so it is the only
   * question this shape can ask honestly.
   *
   * Readings are still taught — `GET /lessons/:id` returns `on` and `kun` on the
   * resolved item, so the lesson screen shows them. They are study material
   * here, not the answer key.
   */
  private readonly KANJI_STYLE: QuestionStyle = {
    ...KANJI_QUESTION,
    pool: async (unit) =>
      (await this.contentService.findUnitKanjiPool(unit)).map((doc) => ({
        id: doc._id.toString(),
        prompt: doc.char,
        answer: doc.meanings.join(', '),
      })),
  };

  private readonly GRAMMAR_STYLE: QuestionStyle = {
    ...GRAMMAR_QUESTION,
    pool: async (unit) =>
      (await this.contentService.findUnitGrammarPool(unit)).flatMap((doc) =>
        toGrammarChoice({ id: doc._id.toString(), examples: doc.examples }),
      ),
  };

  constructor(
    private readonly contentService: ContentService,
    // Cross-module write. The schema is owned by `learning`; the write has to
    // happen here because this is the only call site with the (userId,
    // lessonId, attempt, exerciseId, correct) tuple. The service is the only
    // thing we touch — never the model — which keeps the "module doesn't
    // reach into another module's collections" rule intact.
    @Inject(forwardRef(() => ExerciseAttemptsService))
    private readonly exerciseAttempts: ExerciseAttemptsService,
    // SRS scheduling on wrong answers. forwardRef because ContentModule and
    // LearningModule already have a mutual dependency for ExerciseAttemptsService
    // — this is a second edge in the same cycle, not a new cycle.
    @Inject(forwardRef(() => LearningService))
    private readonly learningService: LearningService,
    // §5.2 / ADR-003: the learner-model write path. Same forwardRef cycle —
    // another edge to `LearningModule`, already exported.
    @Inject(forwardRef(() => LearnerItemStateService))
    private readonly learnerItemStateService: LearnerItemStateService,
    // Phase 2 Exercise Strategy Plugin Registry
    private readonly pluginRegistry?: ExercisePluginRegistry,
  ) {}

  async generate(lessonId: string, userId: string, attempt?: number): Promise<ExerciseSet> {
    const resolvedAttempt =
      attempt ?? (await this.exerciseAttempts.getLatestAttempt(userId, lessonId));
    const { lesson, questions } = await this.buildSet(lessonId, userId, resolvedAttempt);

    return {
      lessonId: lesson.id,
      unit: lesson.unit,
      title: lesson.title,
      attempt: resolvedAttempt,
      questionCount: questions.length,
      questions: questions.map(toPublicQuestion),
    };
  }

  /**
   * Grade one answer.
   *
   * `body` is the discriminated-union body from the request — either an
   * `optionId` for `multipleChoice` or a `text` for `wordReading`. The lesson
   * is consulted to pick which one is valid; an unmatched pair (optionId on a
   * wordReading lesson, text on a multipleChoice lesson) is a 400.
   *
   * For multipleChoice, the matching is `selected.id === question.correctOptionId`.
   * For wordReading, the typed text is normalised (trim, lowercase, collapse
   * whitespace) and compared to the question's canonical romaji. **No fuzzy
   * match.** Doubled consonants or vowels are exactly what the lesson teaches,
   * and an apologetic match would teach the wrong rule.
   */
  async answer(
    lessonId: string,
    exerciseId: string,
    userId: string,
    body: {
      optionId?: string;
      text?: string;
      responseTimeMs?: number;
      /** Internal caller context. Public lesson answers always use `lesson`. */
      sourceContext?: 'lesson' | 'practice';
    },
  ): Promise<AnswerResult> {
    const { attempt, index } = parseExerciseId(exerciseId);

    // Same inputs, same questions — so this is the very set the client was shown.
    const { lesson, questions } = await this.buildSet(lessonId, userId, attempt);

    const question = questions[index];
    if (!question) {
      throw new BadRequestException(`Unknown exercise: ${exerciseId}`);
    }

    // Re-derive which shape this lesson is. Doing it again here (rather than
    // carrying it from generate) means a request without a preceding generate
    // still works, and the gate against a wrong body is local.
    const exerciseType = pickExerciseType(lesson.exerciseTypes);

    // Phase 2 Exercise Plugin Strategy Routing
    if (this.pluginRegistry && this.pluginRegistry.hasPlugin(exerciseType) && exerciseType !== 'multipleChoice' && exerciseType !== 'wordReading') {
      const plugin = this.pluginRegistry.getPlugin(exerciseType);
      const gradeResult = plugin.gradeAnswer(question, {
        optionId: body.optionId,
        text: body.text,
      });

      await this.settleAnswer(
        userId,
        lessonId,
        attempt,
        question.exerciseId,
        gradeResult.correct,
        question,
        body.responseTimeMs,
        body.sourceContext ?? 'lesson',
      );

      return {
        exerciseId: question.exerciseId,
        correct: gradeResult.correct,
        selectedOptionId: body.optionId ?? '',
        selectedValue: gradeResult.selectedValue,
        correctOptionId: question.correctOptionId ?? '',
        correctValue: gradeResult.correctValue,
        prompt: question.prompt,
      };
    }

    if (exerciseType === 'wordReading') {
      if (body.optionId !== undefined) {
        throw new BadRequestException(
          'This lesson takes a typed romaji, not an option selection.',
        );
      }
      if (typeof body.text !== 'string') {
        throw new BadRequestException('This lesson takes a typed romaji in the `text` field.');
      }
      return this.answerWordReading(
        question,
        lessonId,
        userId,
        attempt,
        body.text,
        body.responseTimeMs,
        body.sourceContext ?? 'lesson',
      );
    }

    // exerciseType === 'multipleChoice'.
    if (body.text !== undefined) {
      throw new BadRequestException(
        'This lesson takes an option selection, not a typed answer.',
      );
    }
    if (typeof body.optionId !== 'string') {
      throw new BadRequestException('This lesson takes an option id in the `optionId` field.');
    }

    // The internal shape is uniform — `multipleChoice` carries an `options`
    // array and a `correctOptionId`. A `wordReading` question, here, has
    // neither, so it would 400 the unknown `optionId` lookup below.
    if (!question.options || !question.correctOptionId) {
      throw new BadRequestException(`Exercise ${exerciseId} does not offer option choices.`);
    }

    const selected = question.options.find((option) => option.id === body.optionId);
    if (!selected) {
      throw new BadRequestException(
        `Option ${body.optionId} is not one of this exercise's ${question.options.length} options`,
      );
    }

    const correct = selected.id === question.correctOptionId;

    await this.settleAnswer(
      userId,
      lessonId,
      attempt,
      question.exerciseId,
      correct,
      question,
      body.responseTimeMs,
      body.sourceContext ?? 'lesson',
    );

    return {
      exerciseId: question.exerciseId,
      correct,
      selectedOptionId: selected.id,
      selectedValue: selected.value,
      correctOptionId: question.correctOptionId,
      correctValue: question.correctValue,
      prompt: question.prompt,
    };
  }

  /**
   * The side effect every answer has: record the attempt.
   *
   * On a wrong **lesson** answer there is a second side-effect: pull the SRS
   * card for this item due immediately so the learner will see it in their next
   * review session. Practice callers explicitly opt out: they write confidence
   * evidence and their own durable session result, but scheduling remains the
   * sole responsibility of real Review/lesson events.
   *
   * **Neither can fail the answer.** The attempt record's only expected failure
   * is a duplicate key (the same learner re-answering the same question in the
   * same attempt) which the service swallows; anything else is logged. The SRS
   * scheduling is the same bargain — losing it is a small unfairness in the
   * learner's favour, while a 500 in place of their answer is not recoverable.
   * Same reasoning `AnalyticsService.record` documents.
   */
  private async settleAnswer(
    userId: string,
    lessonId: string,
    attempt: number,
    exerciseId: string,
    correct: boolean,
    question?: GeneratedQuestion,
    responseTimeMs?: number,
    sourceContext: 'lesson' | 'practice' = 'lesson',
  ): Promise<void> {
    // The `(itemId, itemKind, exerciseType)` tuple the persistence layer
    // needs. `question.itemId` is a string on the DTO and an ObjectId on the
    // schema; conversion goes here so the two services never see mismatched
    // shapes. The `isValid` check guards against an ever-malformed string at
    // runtime — in production the value is always an ObjectId-shaped string
    // from `GET /lessons/:id`, but a future client could send anything and
    // `settleAnswer` must not fail the answer over a stale or hostile id.
    // `wordReading` maps to `'vocab'` for the SRS (and now for the learner
    // model) — the same `promptKindToSrsKind` helper below carries both edges.
    const item = question
      ? {
          itemId:
            question.itemId && Types.ObjectId.isValid(question.itemId)
              ? new Types.ObjectId(question.itemId)
              : null,
          itemKind: question.promptKind ? promptKindToSrsKind(question.promptKind) : null,
          exerciseType: question.type,
        }
      : { itemId: null, itemKind: null, exerciseType: null };

    await this.exerciseAttempts
      .recordAttempt(userId, lessonId, attempt, exerciseId, correct, responseTimeMs, item)
      .catch((err: unknown) => {
        this.logger.warn(
          `exerciseAttempt record lost for user ${userId} lesson ${lessonId}: ` +
            `${err instanceof Error ? err.message : String(err)}`,
        );
      });

    // §5.2 / ADR-003: every lesson answer is evidence for the learner model.
    // Fire-and-forget — `record()` itself never throws, but the caller still
    // gets a `.catch` here so a future change in `record()`'s contract cannot
    // fail the answer response.
    if (item.itemId && item.itemKind) {
      this.learnerItemStateService
        .record({
          userId: new Types.ObjectId(userId),
          itemRef: { kind: item.itemKind, id: item.itemId },
          outcome: { correct, responseTimeMs },
          exerciseType: item.exerciseType,
          sourceContext,
        })
        .catch((err: unknown) => {
          this.logger.warn(
            `LearnerItemState record lost for user ${userId} ${item.itemKind} ${item.itemId?.toString()}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        });
    }

    if (correct) {
      return;
    }

    // A missed word is also a character-level signal. The learner may know
    // what 「ねこ」 means yet stumble over ね; recording only the vocab card
    // would make that diagnostic invisible to the next kana-focused lesson.
    // Kana questions already recorded their own item above, so expand only
    // word-shaped prompts. This is intentionally best-effort like the other
    // learning-model writes: feedback to the learner must never become a 500.
    if (question && (question.promptKind === 'vocab' || question.promptKind === 'wordReading')) {
      await this.recordCharacterMistakes(userId, question.prompt, responseTimeMs, sourceContext);
    }

    // Practice is application evidence, not FSRS scheduling input. A mistake
    // still updates LearnerItemState above, but must never pull a card due or
    // otherwise become a disguised Review queue.
    if (sourceContext === 'practice') {
      return;
    }

    // Wrong lesson answer: pull this item's SRS card due immediately so it
    // surfaces in the learner's next review. Fire-and-forget —
    // `scheduleItemDue` never throws, so this cannot fail the answer response.
    if (question?.itemId && question.promptKind) {
      const kind = promptKindToSrsKind(question.promptKind);
      this.learningService
        .scheduleItemDue(userId, question.itemId, kind)
        .catch((err: unknown) => {
          // scheduleItemDue already swallows, but guard here too in case the
          // shape of the method changes.
          this.logger.warn(
            `SRS scheduling lost for user ${userId} item ${question.itemId}: ` +
              `${err instanceof Error ? err.message : String(err)}`,
          );
        });
    }
  }

  private async recordCharacterMistakes(
    userId: string,
    prompt: string,
    responseTimeMs?: number,
    sourceContext: 'lesson' | 'practice' = 'lesson',
  ): Promise<void> {
    try {
      const kana = await this.contentService.findKanaByCharacters(decomposeIntoKana(prompt));
      await Promise.all(
        kana.map((item) =>
          this.learnerItemStateService.record({
            userId: new Types.ObjectId(userId),
            itemRef: { kind: 'kana', id: item._id },
            outcome: { correct: false, responseTimeMs },
            exerciseType: 'wordReading',
            sourceContext: sourceContext === 'practice' ? 'practice' : 'reading',
          }),
        ),
      );
    } catch (err: unknown) {
      this.logger.warn(
        `Character mistake logging lost for user ${userId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /**
   * The wordReading path: normalise the typed input and compare exactly to
   * the canonical romaji.
   *
   * Normalisation is small but deliberate:
   *   - trimmed — leading/trailing whitespace is a typing slip, not an answer
   *   - lowercased — `Gakkou` and `gakkou` are the same answer
   *   - whitespace collapsed — `gak kou` is read as `gakkou` only if the
   *     learner thought of it as one word with a space; we treat that as a
   *     slip and treat the runs as adjacent
   *
   * Anything else (a vowel typing swap, a doubled-consonant typo) is wrong on
   * purpose — that *is* what the lesson teaches.
   */
  private async answerWordReading(
    question: GeneratedQuestion,
    lessonId: string,
    userId: string,
    attempt: number,
    text: string,
    responseTimeMs?: number,
    sourceContext: 'lesson' | 'practice' = 'lesson',
  ): Promise<AnswerResult> {
    const normalized = normaliseAnswer(text);
    const correct = normalized === normaliseAnswer(question.correctValue);

    await this.settleAnswer(
      userId,
      lessonId,
      attempt,
      question.exerciseId,
      correct,
      question,
      responseTimeMs,
      sourceContext,
    );

    return {
      exerciseId: question.exerciseId,
      correct,
      // The body sent a typed answer, not an option selection.
      selectedOptionId: '',
      selectedValue: normalized,
      // For wordReading there is no right option — `correctValue` itself is
      // the answer, and `correctOptionId` carries it back so the client can
      // show "you wrote X, the right answer was Y" without branching on type.
      correctOptionId: '',
      correctValue: question.correctValue,
      prompt: question.prompt,
    };
  }

  /**
   * Pulls content, picks a style and shape, assembles a shuffled set.
   *
   * Dispatch order:
   *   - Pick the lesson's exercise type. `wordReading` overrides content
   *     choices (the choice is "what does the learner see"). Other types
   *     `multipleChoice` dispatch on item kind (kana / vocab / grammar).
   *   - Pick a `QuestionStyle` for the kind. MultipleChoice types need a
   *     distractor pool — the style provides one. WordReading needs nothing
   *     beyond the items themselves.
   *
   * Both branches end at the same place: a list of `GeneratedQuestion` with
   * the answer key in place. `toPublicQuestion` strips it for the wire.
   */
  private async buildSet(
    lessonId: string,
    userId: string,
    attempt: number,
  ): Promise<{ lesson: LessonDetail; questions: GeneratedQuestion[] }> {
    // Reuses the validated read path, so a bad id is a 400 and a missing
    // lesson a 404 before any generation happens.
    const lesson = await this.contentService.findLessonById(lessonId);

    const exerciseType = pickExerciseType(lesson.exerciseTypes);
    if (exerciseType === 'wordReading') {
      return this.buildWordReadingSet(lesson, userId, attempt);
    }
    return this.buildMultipleChoiceSet(lesson, userId, attempt);
  }

  private async buildWordReadingSet(
    lesson: LessonDetail,
    userId: string,
    attempt: number,
  ): Promise<{ lesson: LessonDetail; questions: GeneratedQuestion[] }> {
    // Word-reading lessons are vocab lessons in disguise: each item's lemma
    // is the prompt and each item's romaji is what the learner types. A
    // wordReading lesson with grammar or kana items is a 422 — that
    // combination is not what this exercise can ask about.
    //
    // The choice shape reuses `vocabChoice`, but with `romaji` as the answer
    // rather than `gloss`: that is the only difference from the multipleChoice
    // vocabulary shape, and keeping it local to this branch means the
    // multipleChoice path is untouched.
    const vocab = lesson.items
      .filter(isVocab)
      .filter((item): item is Extract<ResolvedItem, { kind: 'vocab' }> & { romaji: string } =>
        typeof item.romaji === 'string' && item.romaji.length > 0,
      )
      .map((item) => ({ id: item.id, prompt: item.lemma, answer: item.romaji }));

    if (vocab.length === 0) {
      throw new UnprocessableEntityException(
        `${lesson.exerciseTypes.join(', ')} lessons must contain vocabulary items with romaji`,
      );
    }

    // Same shuffle logic as multiple-choice — same deterministic seed path —
    // so a refresh reproduces the question order exactly.
    const order = shuffle(vocab, mulberry32(seedFrom(lesson.id, userId, attempt, 'questions')));

    const questions: GeneratedQuestion[] = order.map((item, index) => ({
      exerciseId: `${attempt}:${index}`,
      // The vocab item's own id — this branch maps straight off `lesson.items`,
      // so it is the same id `GET /lessons/:id` returned.
      itemId: item.id,
      type: 'wordReading',
      prompt: item.prompt,
      promptKind: 'wordReading' as const,
      question: 'How do you read this word?',
      correctValue: item.answer,
    }));

    return { lesson, questions };
  }

  private async buildMultipleChoiceSet(
    lesson: LessonDetail,
    userId: string,
    attempt: number,
  ): Promise<{ lesson: LessonDetail; questions: GeneratedQuestion[] }> {
    // Kana first, then vocab: a lesson is one or the other in practice, and
    // checking in a fixed order keeps a hypothetical mixed lesson deterministic
    // rather than dependent on item order.
    const kana = lesson.items.filter(isKana).map(kanaChoice);
    const vocab = lesson.items.filter(isVocab).map(vocabChoice);
    const grammar = lesson.items.filter(isGrammar).flatMap(toGrammarChoice);
    const kanji = lesson.items.filter(isKanji).flatMap(toKanjiChoice);

    const [answerable, style] =
      kana.length > 0
        ? ([kana, this.KANA_STYLE] as const)
        : vocab.length > 0
          ? ([vocab, this.VOCAB_STYLE] as const)
          : grammar.length > 0
            ? ([grammar, this.GRAMMAR_STYLE] as const)
            : kanji.length > 0
              ? ([kanji, this.KANJI_STYLE] as const)
              : ([[], null] as const);

    if (!style) {
      throw new UnprocessableEntityException(
        `Lesson has no kana, vocabulary, grammar or kanji items to ask about, and ` +
          `${lesson.exerciseTypes.join(', ') || 'this lesson'} asks about those`,
      );
    }

    const unitPool = await style.pool(lesson.unit);

    // Lesson-scoped preferred pool: items from this lesson, keyed by answer so
    // the prefer-then-fallback logic in buildMultipleChoiceQuestion can dedup
    // correctly. This is what fixes OPEN-ITEMS #29 — without it, a question
    // about チーズ in a themed lesson could offer "two", "an answer" and "library"
    // as distractors, all from wildly different themes in the same unit pool.
    //
    // The lesson's answerable items *are* the preferred pool. We re-use the
    // same array rather than a second lookup — they were derived from
    // lesson.items above.
    const lessonPool: Choice[] = answerable;

    // Question order is shuffled — this is a quiz, not the lesson itself, so
    // the pedagogical あいうえお ordering of the lesson deliberately does not
    // carry over. Seeded, so a refresh reproduces it exactly.
    const order = shuffle(answerable, mulberry32(seedFrom(lesson.id, userId, attempt, 'questions')));

    const questions = order.map((item, index) =>
      this.buildMultipleChoiceQuestion(item, lessonPool, unitPool, style, lesson.id, userId, attempt, index),
    );

    return { lesson, questions };
  }

  private buildMultipleChoiceQuestion(
    correct: Choice,
    lessonPool: Choice[],
    unitPool: Choice[],
    style: QuestionStyle,
    lessonId: string,
    userId: string,
    attempt: number,
    index: number,
  ): GeneratedQuestion {
    // Seeded by the item, not its position, so a question keeps its options
    // even if the surrounding order changes.
    const random = mulberry32(seedFrom(lessonId, userId, attempt, 'options', correct.id));

    // Prefer distractors from the lesson (same theme), fall back to the unit
    // when the lesson cannot supply enough — OPEN-ITEMS #29. The rule lives in
    // `question-builder.ts` because the unit checkpoint applies the same one.
    const { options, correctOptionId } = assembleOptions(correct, lessonPool, unitPool, random);

    return {
      exerciseId: `${attempt}:${index}`,
      // `Choice.id` is the source item's id for every kind — the same value the
      // options seed is derived from, which is why a question keeps both its
      // options and its identity when the surrounding order changes.
      itemId: correct.id,
      type: 'multipleChoice',
      prompt: correct.prompt,
      promptKind: style.promptKind,
      question: style.question(correct),
      options,
      correctOptionId,
      correctValue: correct.answer,
    };
  }
}

/**
 * Decide which exercise type the lesson uses. The lesson declares one or
 * more in `exerciseTypes`; the order here is the priority. Today only
 * `multipleChoice` and `wordReading` exist.
 *
 * Throws if none of the requested types is a known one — a lesson that
 * asks for an unrecognised shape is a 422 with the request types listed,
 * which is what the API contract promises.
 */
function pickExerciseType(declared: readonly string[]): 'multipleChoice' | 'wordReading' {
  if (declared.some((t) => TYPING_TYPES.includes(t))) return 'wordReading';
  if (declared.some((t) => OPTION_BASED_TYPES.includes(t))) return 'multipleChoice';

  throw new UnprocessableEntityException(
    `Lesson does not offer a supported exercise type (has: ${declared.join(', ') || 'none'})`,
  );
}

/** exerciseId is "{attempt}:{index}" — it carries everything answering needs. */
function parseExerciseId(exerciseId: string): { attempt: number; index: number } {
  const match = /^(\d{1,5}):(\d{1,4})$/.exec(exerciseId);
  if (!match) {
    throw new BadRequestException(`Malformed exercise id: ${exerciseId}`);
  }

  return { attempt: Number(match[1]), index: Number(match[2]) };
}
