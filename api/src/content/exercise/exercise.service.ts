import { BadRequestException, Inject, Injectable, Logger, UnprocessableEntityException, forwardRef } from '@nestjs/common';
import { ContentService } from '../content.service';
import {
  AnswerResult,
  ExerciseOption,
  ExerciseSet,
  GeneratedQuestion,
  PromptKind,
  toPublicQuestion,
} from '../dto/exercise-response.dto';
import { LessonDetail, ResolvedItem } from '../dto/lesson-response.dto';
import { ExerciseAttemptsService } from '../../learning/exercise-attempts.service';
import { LearningService } from '../../learning/learning.service';
import { UserService } from '../../user/user.service';
import { mulberry32, seedFrom, shuffle } from './deterministic-random';
import { ExercisePluginRegistry } from './plugins/exercise-plugin.registry';

const OPTION_BASED_TYPES = ['multipleChoice'];
const TYPING_TYPES = ['wordReading'];

/**
 * One answerable item, flattened out of whatever kind it came from.
 *
 * `answer` is both the correct option's text and the key distractors are
 * deduped on — two options reading the same thing make a question
 * unanswerable, whichever kind produced them.
 *
 * For typing exercises, `answer` is also what the learner is supposed to type
 * and what the typed input is checked against.
 */
interface Choice {
  id: string;
  prompt: string;
  /** For multipleChoice: the option's value (e.g. `a`). For wordReading: the canonical romaji (e.g. `gakkou`). */
  answer: string;
  /**
   * Extra context the question text needs. Only grammar uses it, to carry the
   * English gloss — 「わたしはいき＿。」 is grammatical with ます, ません and ました
   * alike, so without the gloss the question has three right answers.
   */
  hint?: string;
}

/**
 * How a lesson's items become questions, per item kind. The shape of the
 * question (multipleChoice vs wordReading) is decided by `lesson.exerciseTypes`
 * — `style` is about the *content* (kana, vocab, grammar).
 */
interface QuestionStyle {
  promptKind: PromptKind;
  /**
   * A function rather than a constant because grammar's question changes per
   * item — it has to state which meaning is wanted. Kana and vocab ignore the
   * argument and return the same sentence every time.
   */
  question: (choice: Choice) => string;
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
    promptKind: 'kana',
    question: () => 'Which romaji matches this character?',
    pool: async (unit) =>
      (await this.contentService.findUnitKanaPool(unit)).map((doc) => ({
        id: doc._id.toString(),
        prompt: doc.kana,
        answer: doc.romaji,
      })),
  };

  private readonly VOCAB_STYLE: QuestionStyle = {
    promptKind: 'vocab',
    question: () => 'What does this word mean?',
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
    promptKind: 'kanji',
    question: () => 'What does this kanji mean?',
    pool: async (unit) =>
      (await this.contentService.findUnitKanjiPool(unit)).map((doc) => ({
        id: doc._id.toString(),
        prompt: doc.char,
        answer: doc.meanings.join(', '),
      })),
  };

  private readonly GRAMMAR_STYLE: QuestionStyle = {
    promptKind: 'grammar',
    question: (choice) =>
      choice.hint ? `Which fills the gap? — “${choice.hint}”` : 'Which fills the gap?',
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
    // Hearts live on the user document, so the deduction goes through the owning
    // service. No forwardRef needed — `user` knows nothing about `content`, so
    // this edge runs one way only, unlike the learning pair above.
    private readonly userService: UserService,
    // SRS scheduling on wrong answers. forwardRef because ContentModule and
    // LearningModule already have a mutual dependency for ExerciseAttemptsService
    // — this is a second edge in the same cycle, not a new cycle.
    @Inject(forwardRef(() => LearningService))
    private readonly learningService: LearningService,
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
    body: { optionId?: string; text?: string; responseTimeMs?: number },
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

      const heartsLeft = await this.settleAnswer(
        userId,
        lessonId,
        attempt,
        question.exerciseId,
        gradeResult.correct,
        question,
        body.responseTimeMs,
      );

      return {
        exerciseId: question.exerciseId,
        correct: gradeResult.correct,
        selectedOptionId: body.optionId ?? '',
        selectedValue: gradeResult.selectedValue,
        correctOptionId: question.correctOptionId ?? '',
        correctValue: gradeResult.correctValue,
        prompt: question.prompt,
        heartsLeft,
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

    const heartsLeft = await this.settleAnswer(
      userId,
      lessonId,
      attempt,
      question.exerciseId,
      correct,
      question,
      body.responseTimeMs,
    );

    return {
      exerciseId: question.exerciseId,
      correct,
      selectedOptionId: selected.id,
      selectedValue: selected.value,
      correctOptionId: question.correctOptionId,
      correctValue: question.correctValue,
      prompt: question.prompt,
      heartsLeft,
    };
  }

  /**
   * The two side effects every answer has, in one place so the multipleChoice and
   * wordReading paths cannot drift: record the attempt, and take a heart if it was
   * wrong.
   *
   * On a wrong answer there is a third side-effect: pull the SRS card for this
   * item due immediately so the learner will see it in their next review session.
   * This closes the gap where exercise mistakes were recorded in `exerciseAttempts`
   * but never fed back into the SRS schedule (OPEN-ITEMS §26 exercise-answer path).
   *
   * **Neither can fail the answer.** The attempt record's only expected failure is
   * a duplicate key (the same learner re-answering the same question in the same
   * attempt) which the service swallows; anything else is logged. The heart write
   * and the SRS scheduling are the same bargain — losing them is a small
   * unfairness in the learner's favour, while a 500 in place of their answer is
   * not recoverable. Same reasoning `AnalyticsService.record` documents.
   *
   * Returns the hearts remaining, or `null` when nothing was charged (a correct
   * answer) or the charge failed, so the client can leave its counter alone rather
   * than rendering a wrong number.
   */
  private async settleAnswer(
    userId: string,
    lessonId: string,
    attempt: number,
    exerciseId: string,
    correct: boolean,
    question?: GeneratedQuestion,
    responseTimeMs?: number,
  ): Promise<number | null> {
    await this.exerciseAttempts
      .recordAttempt(userId, lessonId, attempt, exerciseId, correct, responseTimeMs)
      .catch((err: unknown) => {
        this.logger.warn(
          `exerciseAttempt record lost for user ${userId} lesson ${lessonId}: ` +
            `${err instanceof Error ? err.message : String(err)}`,
        );
      });

    if (correct) {
      return null;
    }

    // Wrong answer: pull this item's SRS card due immediately so it surfaces in
    // the learner's next review. Fire-and-forget — `scheduleItemDue` never
    // throws, so this cannot fail the answer response.
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

    return this.userService
      .loseHeart(userId)
      .then((result) => result.hearts)
      .catch((err: unknown) => {
        this.logger.warn(
          `heart deduction lost for user ${userId}: ` +
            `${err instanceof Error ? err.message : String(err)}`,
        );
        return null;
      });
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
  ): Promise<AnswerResult> {
    const normalized = normaliseAnswer(text);
    const correct = normalized === normaliseAnswer(question.correctValue);

    const heartsLeft = await this.settleAnswer(
      userId,
      lessonId,
      attempt,
      question.exerciseId,
      correct,
      question,
      responseTimeMs,
    );

    return {
      heartsLeft,
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
    // when the lesson cannot supply enough. This is the fix for OPEN-ITEMS #29:
    // a question about チーズ should be confused with other food words, not
    // with "library" and "two" from different themed lessons in the same unit.
    //
    // Strategy:
    //   1. Take up to OPTIONS_PER_QUESTION-1 from the lesson pool (excluding
    //      the correct answer and any answer-duplicate).
    //   2. If still short, fill from the unit pool (same dedup rules).
    // The seen-set spans both passes so a unit item that duplicates a lesson
    // item's *answer text* is also excluded.
    const needed = OPTIONS_PER_QUESTION - 1;
    const lessonDistractors = shuffle(distractorPool(lessonPool, correct), random);
    const taken = lessonDistractors.slice(0, needed);

    if (taken.length < needed) {
      // Build a dedup set from what we already have (including the correct answer).
      const seen = new Set<string>([correct.answer, ...taken.map((c) => c.answer)]);
      const fallback: Choice[] = [];
      for (const candidate of shuffle(distractorPool(unitPool, correct), random)) {
        if (seen.has(candidate.answer)) continue;
        seen.add(candidate.answer);
        fallback.push(candidate);
        if (taken.length + fallback.length >= needed) break;
      }
      taken.push(...fallback);
    }

    const options: ExerciseOption[] = shuffle([correct, ...taken], random).map(
      (choice, position) => ({ id: `opt-${position}`, value: choice.answer }),
    );

    const correctOption = options.find((option) => option.value === correct.answer);
    if (!correctOption) {
      // Unreachable — the correct choice is always in the shuffled array.
      throw new Error(`Correct answer ${correct.answer} vanished during option assembly`);
    }

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
      correctOptionId: correctOption.id,
      correctValue: correct.answer,
    };
  }
}

const OPTIONS_PER_QUESTION = 4;

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

/**
 * The three normalisations applied to a typed answer.
 *
 * `toLowerCase` and `replace(/\s+/g, '')` together make "  Gak Kou " and
 * "gakkou" land on the same canonical answer, while still keeping the
 * doubled consonant unambiguous. (A learner who wrote "gakou" still gets it
 * wrong on purpose.)
 */
function normaliseAnswer(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, '');
}

/**
 * Distractors come from real items in the unit, never generated strings.
 *
 * Deduped by answer because Japanese genuinely has distinct kana that share a
 * reading — じ and ぢ are both "ji", as are づ and ず ("zu") — and two words can
 * share a gloss. Two identical options would make a question unanswerable.
 */
function distractorPool(pool: Choice[], correct: Choice): Choice[] {
  const seen = new Set<string>([correct.answer]);
  const unique: Choice[] = [];

  for (const candidate of pool) {
    if (seen.has(candidate.answer)) continue;
    seen.add(candidate.answer);
    unique.push(candidate);
  }

  return unique;
}

function isKana(item: ResolvedItem): item is Extract<ResolvedItem, { kind: 'kana' }> {
  return item.kind === 'kana';
}

function isVocab(item: ResolvedItem): item is Extract<ResolvedItem, { kind: 'vocab' }> {
  return item.kind === 'vocab';
}

function kanaChoice(item: Extract<ResolvedItem, { kind: 'kana' }>): Choice {
  return { id: item.id, prompt: item.kana, answer: item.romaji };
}

/**
 * The word is the prompt and the meaning is the answer — recognition, the same
 * direction as kana → romaji. `lemma`, not `reading`: they are identical in the
 * only vocabulary unit that exists, and when kanji arrive the written form is
 * what a learner needs to recognise.
 */
function vocabChoice(item: Extract<ResolvedItem, { kind: 'vocab' }>): Choice {
  return { id: item.id, prompt: item.lemma, answer: item.gloss };
}

function isGrammar(item: ResolvedItem): item is Extract<ResolvedItem, { kind: 'grammar' }> {
  return item.kind === 'grammar';
}

function isKanji(item: ResolvedItem): item is Extract<ResolvedItem, { kind: 'kanji' }> {
  return item.kind === 'kanji';
}

/**
 * The glyph is the prompt and its meanings are the answer.
 *
 * Returns an array rather than a Choice so a kanji with no meanings drops out
 * instead of producing an option with an empty label — the same shape
 * `toGrammarChoice` uses for a point with no examples. `meanings` is
 * `default: []` on the schema, so an entry seeded without them is possible and
 * would otherwise render a blank option.
 */
function toKanjiChoice(item: Extract<ResolvedItem, { kind: 'kanji' }>): Choice[] {
  if (item.meanings.length === 0) {
    return [];
  }

  return [{ id: item.id, prompt: item.char, answer: item.meanings.join(', ') }];
}

/**
 * The first example becomes the question: the gapped sentence is the prompt and
 * what fills the gap is the answer.
 *
 * Returns an array rather than a Choice so a point with no examples drops out
 * instead of producing a question with an empty prompt — a grammar point is
 * still valid content without one, it just cannot be quizzed this way.
 */
function toGrammarChoice(item: {
  id: string;
  examples: { sentence: string; answer: string; gloss: string }[];
}): Choice[] {
  const example = item.examples[0];
  if (!example) return [];

  return [
    { id: item.id, prompt: example.sentence, answer: example.answer, hint: example.gloss },
  ];
}

/** exerciseId is "{attempt}:{index}" — it carries everything answering needs. */
function parseExerciseId(exerciseId: string): { attempt: number; index: number } {
  const match = /^(\d{1,5}):(\d{1,4})$/.exec(exerciseId);
  if (!match) {
    throw new BadRequestException(`Malformed exercise id: ${exerciseId}`);
  }

  return { attempt: Number(match[1]), index: Number(match[2]) };
}

/**
 * Maps the prompt kind (how the question is displayed) to the SRS item kind
 * (how the card is stored). They are mostly identical, but `wordReading` is a
 * display-level concept — the underlying item is always a vocabulary word, so
 * the card kind is `'vocab'`.
 */
function promptKindToSrsKind(promptKind: PromptKind): string {
  if (promptKind === 'wordReading') return 'vocab';
  return promptKind; // 'kana' | 'vocab' | 'grammar' | 'kanji' map to themselves
}
