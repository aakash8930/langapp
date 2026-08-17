import { CheckpointQuestion } from '../../learning/schemas/unit-checkpoint-attempt.schema';
import { ExerciseOption, PromptKind } from './exercise-response.dto';

/**
 * A checkpoint question on the wire. Same fields a lesson `Question` carries,
 * so a client can render both with one component.
 */
export interface PublicCheckpointQuestion {
  exerciseId: string;
  itemId: string;
  type: string;
  prompt: string;
  promptKind: string;
  question: string;
  /** Absent for `wordReading`, which is typed. */
  options?: ExerciseOption[];
}

export interface CheckpointSet {
  unit: string;
  attempt: number;
  questionCount: number;
  /** The fraction needed to pass, so the client states the bar rather than hard-coding it. */
  passMark: number;
  questions: PublicCheckpointQuestion[];
}

/** One item the learner got wrong, with its answer — released only at submit. */
export interface CheckpointMiss {
  itemId: string;
  prompt: string;
  promptKind: PromptKind | string;
  correctValue: string;
  /** `false` when the learner ran out of time or submitted early. */
  answered: boolean;
}

export interface CheckpointResult {
  unit: string;
  attempt: number;
  questionCount: number;
  correctCount: number;
  /** Fraction 0..1, rounded to 2dp. */
  score: number;
  passMark: number;
  passed: boolean;
  xpAwarded: number;
  missed: CheckpointMiss[];
}

/**
 * Strip the answer key off a stored question.
 *
 * An explicit field copy rather than a `delete`, for the same reason
 * `toPublicQuestion` is: an allowlist cannot leak a field somebody adds to the
 * schema later. This one matters more than the lesson's, because here the
 * answer key really is sitting in the document — `correctValue` and
 * `correctOptionId` are two properties away from the response, and `correct`
 * would tell a mid-test client how it is doing.
 */
export function toPublicCheckpointQuestion(
  question: CheckpointQuestion,
): PublicCheckpointQuestion {
  const base: PublicCheckpointQuestion = {
    exerciseId: question.exerciseId,
    itemId: question.itemId.toString(),
    type: question.exerciseType,
    prompt: question.prompt,
    promptKind: question.promptKind,
    question: question.question,
  };

  if (question.exerciseType === 'wordReading') {
    return base;
  }

  return {
    ...base,
    options: question.options.map((option) => ({ id: option.id, value: option.value })),
  };
}
