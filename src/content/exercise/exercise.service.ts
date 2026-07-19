import { BadRequestException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ContentService } from '../content.service';
import {
  AnswerResult,
  ExerciseOption,
  ExerciseSet,
  GeneratedQuestion,
  toPublicQuestion,
} from '../dto/exercise-response.dto';
import { LessonDetail, ResolvedItem } from '../dto/lesson-response.dto';
import { mulberry32, seedFrom, shuffle } from './deterministic-random';

const EXERCISE_TYPE = 'multipleChoice';
const OPTIONS_PER_QUESTION = 4;

interface KanaChoice {
  id: string;
  kana: string;
  romaji: string;
}

/**
 * Milestone 3: multiple choice only. Show a kana character, offer romaji.
 *
 * Nothing is persisted. Generation is a pure function of
 * (lessonId, userId, attempt) plus content, so answering re-derives the same
 * set and checks against it — which is what keeps the answer key out of the
 * response without needing a store or a TTL.
 */
@Injectable()
export class ExerciseService {
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

    const answerable = lesson.items.filter(isKana).map(toChoice);
    if (answerable.length === 0) {
      throw new UnprocessableEntityException(
        `Lesson has no kana items, and ${EXERCISE_TYPE} currently only asks about kana`,
      );
    }

    const pool = (await this.contentService.findUnitKanaPool(lesson.unit)).map((doc) => ({
      id: doc._id.toString(),
      kana: doc.kana,
      romaji: doc.romaji,
    }));

    // Question order is shuffled — this is a quiz, not the lesson itself, so
    // the pedagogical あいうえお ordering of the lesson deliberately does not
    // carry over. Seeded, so a refresh reproduces it exactly.
    const order = shuffle(answerable, mulberry32(seedFrom(lessonId, userId, attempt, 'questions')));

    const questions = order.map((item, index) =>
      this.buildQuestion(item, pool, lessonId, userId, attempt, index),
    );

    return { lesson, questions };
  }

  private buildQuestion(
    correct: KanaChoice,
    pool: KanaChoice[],
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
      (choice, position) => ({ id: `opt-${position}`, value: choice.romaji }),
    );

    const correctOption = options.find((option) => option.value === correct.romaji);
    if (!correctOption) {
      // Unreachable — the correct choice is always in the shuffled array.
      throw new Error(`Correct answer ${correct.romaji} vanished during option assembly`);
    }

    return {
      exerciseId: `${attempt}:${index}`,
      type: EXERCISE_TYPE,
      prompt: correct.kana,
      promptKind: 'kana',
      question: 'Which romaji matches this character?',
      options,
      correctOptionId: correctOption.id,
      correctValue: correct.romaji,
    };
  }
}

/**
 * Distractors come from real characters in the unit, never generated strings.
 *
 * Deduped by romaji because Japanese genuinely has distinct kana that share a
 * reading — じ and ぢ are both "ji", as are づ and ず ("zu"). Two identical
 * options would make a question unanswerable.
 */
function distractorPool(pool: KanaChoice[], correct: KanaChoice): KanaChoice[] {
  const seen = new Set<string>([correct.romaji]);
  const unique: KanaChoice[] = [];

  for (const candidate of pool) {
    if (seen.has(candidate.romaji)) continue;
    seen.add(candidate.romaji);
    unique.push(candidate);
  }

  return unique;
}

function isKana(item: ResolvedItem): item is Extract<ResolvedItem, { kind: 'kana' }> {
  return item.kind === 'kana';
}

function toChoice(item: Extract<ResolvedItem, { kind: 'kana' }>): KanaChoice {
  return { id: item.id, kana: item.kana, romaji: item.romaji };
}

/** exerciseId is "{attempt}:{index}" — it carries everything answering needs. */
function parseExerciseId(exerciseId: string): { attempt: number; index: number } {
  const match = /^(\d{1,5}):(\d{1,4})$/.exec(exerciseId);
  if (!match) {
    throw new BadRequestException(`Malformed exercise id: ${exerciseId}`);
  }

  return { attempt: Number(match[1]), index: Number(match[2]) };
}
