/**
 * The public exercise payload. Note what is absent: no correct flag, no answer
 * index, no answer key. The correct option is recoverable only by regenerating
 * the set server-side from (lesson, user, attempt).
 */
export interface ExerciseOption {
  id: string;
  value: string;
}

export interface MultipleChoiceQuestion {
  exerciseId: string;
  type: 'multipleChoice';
  /** The character being asked about. */
  prompt: string;
  promptKind: 'kana';
  question: string;
  options: ExerciseOption[];
}

export interface ExerciseSet {
  lessonId: string;
  unit: string;
  title: string;
  attempt: number;
  questionCount: number;
  questions: MultipleChoiceQuestion[];
}

export interface AnswerResult {
  exerciseId: string;
  correct: boolean;
  /** Echoed back so a client can highlight what was picked. */
  selectedOptionId: string;
  selectedValue: string | null;
  correctOptionId: string;
  correctValue: string;
  prompt: string;
}

/** Internal only — carries the answer, and never leaves the service. */
export interface GeneratedQuestion extends MultipleChoiceQuestion {
  correctOptionId: string;
  correctValue: string;
}

export function toPublicQuestion(question: GeneratedQuestion): MultipleChoiceQuestion {
  // Explicit field copy, not a delete — an allowlist can't leak a field that
  // someone adds to GeneratedQuestion later.
  return {
    exerciseId: question.exerciseId,
    type: question.type,
    prompt: question.prompt,
    promptKind: question.promptKind,
    question: question.question,
    options: question.options.map((option) => ({ id: option.id, value: option.value })),
  };
}
