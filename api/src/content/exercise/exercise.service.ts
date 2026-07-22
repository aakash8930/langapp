import { BadRequestException, Injectable, UnprocessableEntityException } from '@nestjs/common';
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
import { mulberry32, seedFrom, shuffle } from './deterministic-random';

const EXERCISE_TYPE = 'multipleChoice';
const OPTIONS_PER_QUESTION = 4;

/**
 * One answerable item, flattened out of whatever kind it came from.
 *
 * `answer` is both the correct option's text and the key distractors are
 * deduped on — two options reading the same thing make a question
 * unanswerable, whichever kind produced them.
 */
interface Choice {
  id: string;
  prompt: string;
  answer: string;
  /**
   * Extra context the question text needs. Only grammar uses it, to carry the
   * English gloss — 「わたしはいき＿。」 is grammatical with ます, ません and ました
   * alike, so without the gloss the question has three right answers.
   */
  hint?: string;
}

/** How a lesson's items become questions, per item kind. */
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

  constructor(private readonly contentService: ContentService) {}

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

  async answer(
    lessonId: string,
    exerciseId: string,
    userId: string,
    optionId: string,
  ): Promise<AnswerResult> {
    const { attempt, index } = parseExerciseId(exerciseId);

    // Same inputs, same questions — so this is the very set the client was shown.
    const { questions } = await this.buildSet(lessonId, userId, attempt);

    const question = questions[index];
    if (!question) {
      throw new BadRequestException(`Unknown exercise: ${exerciseId}`);
    }

    const selected = question.options.find((option) => option.id === optionId);
    if (!selected) {
      throw new BadRequestException(
        `Option ${optionId} is not one of this exercise's ${question.options.length} options`,
      );
    }

    return {
      exerciseId: question.exerciseId,
      correct: selected.id === question.correctOptionId,
      selectedOptionId: selected.id,
      selectedValue: selected.value,
      correctOptionId: question.correctOptionId,
      correctValue: question.correctValue,
      prompt: question.prompt,
    };
  }

  private async buildSet(
    lessonId: string,
    userId: string,
    attempt: number,
  ): Promise<{ lesson: LessonDetail; questions: GeneratedQuestion[] }> {
    // Reuses the validated read path, so a bad id is a 400 and a missing
    // lesson a 404 before any generation happens.
    const lesson = await this.contentService.findLessonById(lessonId);

    if (!lesson.exerciseTypes.includes(EXERCISE_TYPE)) {
      throw new UnprocessableEntityException(
        `Lesson does not offer ${EXERCISE_TYPE} (has: ${lesson.exerciseTypes.join(', ') || 'none'})`,
      );
    }

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
          `${EXERCISE_TYPE} asks about those`,
      );
    }

    const pool = await style.pool(lesson.unit);

    // Question order is shuffled — this is a quiz, not the lesson itself, so
    // the pedagogical あいうえお ordering of the lesson deliberately does not
    // carry over. Seeded, so a refresh reproduces it exactly.
    const order = shuffle(answerable, mulberry32(seedFrom(lessonId, userId, attempt, 'questions')));

    const questions = order.map((item, index) =>
      this.buildQuestion(item, pool, style, lessonId, userId, attempt, index),
    );

    return { lesson, questions };
  }

  private buildQuestion(
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
      type: EXERCISE_TYPE,
      prompt: correct.prompt,
      promptKind: style.promptKind,
      question: style.question(correct),
      options,
      correctOptionId: correctOption.id,
      correctValue: correct.answer,
    };
  }
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
