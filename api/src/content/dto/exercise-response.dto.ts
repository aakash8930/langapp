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

/**
 * Which content item a question's prompt came from — the same `id` that
 * `GET /lessons/:id` returns on the resolved item. Declared once here because
 * both question shapes carry it and the reasoning is identical.
 *
 * It exists because a question is otherwise anonymous: `exerciseId` is
 * `"{attempt}:{index}"`, a position in a shuffle, and nothing in the payload
 * says *which word* is being asked about. A client that wants to do anything
 * per-item — play the word's audio, link to a detail view, count what a learner
 * struggles with — has only the prompt string to key on, and matching on
 * display text is a bug waiting for two items to share a prompt.
 *
 * **Sent for every kind, not only the ones with audio.** Audio is a
 * vocabulary-only feature today, so it is tempting to send this only where a
 * `.wav` exists. That would be the server deciding a display rule, which is
 * exactly the mistake the `romaji` field avoids: the data stays complete and
 * each surface decides what to do with it. A client shows a speak button when
 * `promptKind` says the prompt is a word; that rule belongs with the client.
 *
 * For `grammar` this identifies the **grammar point**, not the example
 * sentence. A point contributes at most one question (its first example), so
 * the mapping is still one-to-one — but the id resolves to the point.
 *
 * **It does not widen what an answer-hunting client can reach.** `/lessons/:id`
 * is unauthenticated and already returns every item with its gloss, romaji,
 * meanings and grammar answers, and the prompt *is* the item's own text — so
 * that lookup was always available by string match. This makes an existing path
 * exact rather than opening a new one. What stays protected is unchanged: which
 * option is correct never leaves the service, and `/complete` gates on
 * server-recorded answers rather than on anything the client asserts.
 */
type ItemId = string;

export interface MultipleChoiceQuestion {
  exerciseId: string;
  itemId: ItemId;
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
  itemId: ItemId;
  type: 'wordReading';
  /** The word being asked about, e.g. がっこう. */
  prompt: string;
  promptKind: PromptKind;
  question: string;
}

export type ExerciseType =
  | 'multipleChoice'
  | 'wordReading'
  | 'listening'
  | 'sentenceBuilding'
  | 'fillInTheBlank'
  | 'flashcard';

export interface GenericExerciseQuestion {
  exerciseId: string;
  itemId: ItemId;
  type: Exclude<ExerciseType, 'multipleChoice' | 'wordReading'>;
  prompt: string;
  promptKind: PromptKind;
  question: string;
  options?: ExerciseOption[];
}

/** The public question, no answer key. */
export type Question = MultipleChoiceQuestion | WordReadingQuestion | GenericExerciseQuestion;

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
  itemId: ItemId;
  type: ExerciseType;
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
    const mc: MultipleChoiceQuestion = {
      exerciseId: question.exerciseId,
      itemId: question.itemId,
      type: 'multipleChoice',
      prompt: question.prompt,
      promptKind: question.promptKind,
      question: question.question,
      options: (question.options ?? []).map((option) => ({ id: option.id, value: option.value })),
    };
    return mc;
  }

  if (question.type === 'wordReading') {
    const wr: WordReadingQuestion = {
      exerciseId: question.exerciseId,
      itemId: question.itemId,
      type: 'wordReading',
      prompt: question.prompt,
      promptKind: question.promptKind,
      question: question.question,
    };
    return wr;
  }

  const generic: GenericExerciseQuestion = {
    exerciseId: question.exerciseId,
    itemId: question.itemId,
    type: question.type,
    prompt: question.prompt,
    promptKind: question.promptKind,
    question: question.question,
    options: question.options ? question.options.map((option) => ({ id: option.id, value: option.value })) : undefined,
  };
  return generic;
}
