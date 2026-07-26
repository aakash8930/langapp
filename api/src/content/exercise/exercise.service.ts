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
import { mulberry32, seedFrom, shuffle } from './deterministic-random';

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
  ) {}

  async generate(lessonId: string, userId: string, attempt: number): Promise<ExerciseSet> {
    const { lesson, questions } = await this.buildSet(lessonId, userId, attempt);

    return {
      lessonId: lesson.id,
      unit: lesson.unit,
      title: lesson.title,
      attempt,
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
    body: { optionId?: string; text?: string },
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
    if (exerciseType === 'wordReading') {
      if (body.optionId !== undefined) {
        throw new BadRequestException(
          'This lesson takes a typed romaji, not an option selection.',
        );
      }
      if (typeof body.text !== 'string') {
        throw new BadRequestException('This lesson takes a typed romaji in the `text` field.');
      }
      return this.answerWordReading(question, lessonId, userId, attempt, body.text);
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

    // Persist the attempt. Done after the correctness check so a duplicate-key
    // race is impossible: the only failure mode is "row already exists" (same
    // user re-answering the same question in the same attempt), and the
    // service swallows it. We do not gate the answer response on the write
    // succeeding — losing one attempt record is recoverable, denying the
    // learner their answer is not.
    await this.exerciseAttempts
      .recordAttempt(userId, lessonId, attempt, question.exerciseId, correct)
      .catch((err: unknown) => {
        // Service already handles duplicate-key. Anything else is unexpected
        // and worth a log; we still let the answer through.
        this.logger.warn(
          `exerciseAttempt record lost for user ${userId} lesson ${lessonId}: ` +
            `${err instanceof Error ? err.message : String(err)}`,
        );
      });

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
  ): Promise<AnswerResult> {
    const normalized = normaliseAnswer(text);
    const correct = normalized === normaliseAnswer(question.correctValue);

    await this.exerciseAttempts
      .recordAttempt(userId, lessonId, attempt, question.exerciseId, correct)
      .catch((err: unknown) => {
        this.logger.warn(
          `exerciseAttempt record lost for user ${userId} lesson ${lessonId}: ` +
            `${err instanceof Error ? err.message : String(err)}`,
        );
      });

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

    const [answerable, style] =
      kana.length > 0
        ? ([kana, this.KANA_STYLE] as const)
        : vocab.length > 0
          ? ([vocab, this.VOCAB_STYLE] as const)
          : grammar.length > 0
            ? ([grammar, this.GRAMMAR_STYLE] as const)
            : ([[], null] as const);

    if (!style) {
      throw new UnprocessableEntityException(
        `Lesson has no kana, vocabulary or grammar items with examples, and ` +
          `${lesson.exerciseTypes.join(', ') || 'this lesson'} asks about those`,
      );
    }

    const pool = await style.pool(lesson.unit);

    // Question order is shuffled — this is a quiz, not the lesson itself, so
    // the pedagogical あいうえお ordering of the lesson deliberately does not
    // carry over. Seeded, so a refresh reproduces it exactly.
    const order = shuffle(answerable, mulberry32(seedFrom(lesson.id, userId, attempt, 'questions')));

    const questions = order.map((item, index) =>
      this.buildMultipleChoiceQuestion(item, pool, style, lesson.id, userId, attempt, index),
    );

    return { lesson, questions };
  }

  private buildMultipleChoiceQuestion(
    correct: Choice,
    pool: Choice[],
    style: QuestionStyle,
    lessonId: string,
    userId: string,
    attempt: number,
    index: number,
  ): GeneratedQuestion {
    // Seeded by the item, not its position, so a question keeps its options
    // even if the surrounding order changes.
    const random = mulberry32(seedFrom(lessonId, userId, attempt, 'options', correct.id));

    const distractors = shuffle(distractorPool(pool, correct), random).slice(
      0,
      OPTIONS_PER_QUESTION - 1,
    );

    const options: ExerciseOption[] = shuffle([correct, ...distractors], random).map(
      (choice, position) => ({ id: `opt-${position}`, value: choice.answer }),
    );

    const correctOption = options.find((option) => option.value === correct.answer);
    if (!correctOption) {
      // Unreachable — the correct choice is always in the shuffled array.
      throw new Error(`Correct answer ${correct.answer} vanished during option assembly`);
    }

    return {
      exerciseId: `${attempt}:${index}`,
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
