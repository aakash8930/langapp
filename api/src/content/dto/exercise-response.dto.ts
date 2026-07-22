/**
 * The public exercise payload. Note what is absent: no correct flag, no answer
 * index, no answer key. The correct option is recoverable only by regenerating
 * the set server-side from (lesson, user, attempt).
 */
export interface ExerciseOption {
  id: string;
  value: string;
}

/**
 * What the prompt *is*, so a client can size it. A kana prompt is one glyph and
 * belongs in a manuscript cell; a vocab prompt is a whole word and does not fit
 * in one; a grammar prompt is a sentence with a gap and needs to wrap. Without
 * this the client would have to guess from string length.
 */
export type PromptKind = 'kana' | 'vocab' | 'grammar';

export interface MultipleChoiceQuestion {
  exerciseId: string;
  type: 'multipleChoice';
  /** The character or word being asked about. */
  prompt: string;
  promptKind: PromptKind;
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
