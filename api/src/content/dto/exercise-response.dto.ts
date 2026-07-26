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
 * What the prompt *is*, so a client can size it. A `kana` prompt is one glyph
 * and belongs in a manuscript cell; a `vocab` prompt is a whole word and does
 * not fit in one; a `grammar` prompt is a sentence with a gap and needs to
 * wrap. `wordReading` is a whole word again, but a learner is shown the word
 * and types romaji — the prompt is the same shape as `vocab`, and the same
 * sizing rules apply. Without this the client would have to guess from string
 * length.
 *
 * `kanji` is one glyph like `kana`, but deliberately its own kind rather than
 * reusing it: a kanji is denser than a kana at the same point size — 曜 has 18
 * strokes where the busiest kana has 4 — so a client that renders it in a kana
 * cell renders an unreadable smudge. Same sizing *rule*, different size.
 */
export type PromptKind = 'kana' | 'vocab' | 'grammar' | 'wordReading' | 'kanji';

export interface MultipleChoiceQuestion {
  exerciseId: string;
  type: 'multipleChoice';
  /** The character or word being asked about. */
  prompt: string;
  promptKind: PromptKind;
  question: string;
  options: ExerciseOption[];
}

/**
 * A typing question: the prompt is a word the learner reads, and they
 * type the romaji. No options — the answer is `correctValue`, kept server-side.
 *
 * The kind is `wordReading` because that is the only use case: っ and ー
 * require the learner to *produce* the doubled consonant or vowel that a
 * multiple-choice question can only offer as a pre-built option.
 */
export interface WordReadingQuestion {
  exerciseId: string;
  type: 'wordReading';
  /** The word being asked about, e.g. がっこう. */
  prompt: string;
  promptKind: PromptKind;
  question: string;
}

/** The public question, no answer key. */
export type Question = MultipleChoiceQuestion | WordReadingQuestion;

export interface ExerciseSet {
  lessonId: string;
  unit: string;
  title: string;
  attempt: number;
  questionCount: number;
  questions: Question[];
}

/**
 * The answer result.
 *
 * `selectedOptionId` and `correctOptionId` are populated for `multipleChoice`
 * only; both are the empty string for `wordReading`. The typed answer is in
 * `selectedValue` and the canonical reading is in `correctValue`. The client
 * picks which field to render based on the question's `type`.
 */
export interface AnswerResult {
  exerciseId: string;
  correct: boolean;
  /** `optionId` for multipleChoice, the empty string for wordReading. */
  selectedOptionId: string;
  /** The option value picked, or the typed text for wordReading. */
  selectedValue: string | null;
  /**
   * For multipleChoice: the option id of the right answer (so the client can
   * highlight it). For wordReading: the empty string — the canonical romaji
   * is in `correctValue`.
   */
  correctOptionId: string;
  correctValue: string;
  prompt: string;
  /**
   * Hearts remaining after this answer, or `null` when nothing was charged.
   *
   * Null means one of two things and the client treats them the same way — leave
   * the counter alone: either the answer was **correct** (no charge), or the
   * charge itself failed (logged server-side, and deliberately not fatal to the
   * answer). Sending a stale number in the failure case would be worse than
   * sending none, since the header would then disagree with `/me/progress`.
   */
  heartsLeft: number | null;
}

/**
 * Internal only — carries the answer, and never leaves the service.
 *
 * The shape is one type rather than a union because the generation path
 * (which is the only path that sees the answer key) treats all questions
 * uniformly: there is always a `correctValue`, and there is always an
 * `exerciseId`. The `multipleChoice` flavour adds `correctOptionId` and
 * `options`; the `wordReading` flavour leaves the kind obvious from the
 * shape.
 */
export interface GeneratedQuestion {
  exerciseId: string;
  type: 'multipleChoice' | 'wordReading';
  prompt: string;
  promptKind: PromptKind;
  question: string;
  options?: ExerciseOption[];
  /** Set on multipleChoice. The id of the right option. */
  correctOptionId?: string;
  /** The canonical answer. For multipleChoice, the option's value. */
  correctValue: string;
}

export function toPublicQuestion(question: GeneratedQuestion): Question {
  // Explicit field copy, not a delete — an allowlist can't leak a field that
  // someone adds to GeneratedQuestion later.
  if (question.type === 'multipleChoice') {
    return {
      exerciseId: question.exerciseId,
      type: 'multipleChoice',
      prompt: question.prompt,
      promptKind: question.promptKind,
      question: question.question,
      // The options are an exercise-specific field; the public type explicitly
      // declares it, so a missing value here is a code bug, not a missing field.
      options: (question.options ?? []).map((option) => ({ id: option.id, value: option.value })),
    };
  }

  return {
    exerciseId: question.exerciseId,
    type: 'wordReading',
    prompt: question.prompt,
    promptKind: question.promptKind,
    question: question.question,
  };
}
