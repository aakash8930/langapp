import { api } from './client';

/** Mirrors the interfaces in api/src/content/dto/exercise-response.dto.ts. */

export type ExerciseOption = {
  id: string;
  value: string;
};

/**
 * What the prompt is, so the screen can size it. A `kana` prompt is one glyph
 * and belongs in a manuscript cell; a `vocab` prompt is a whole word and does
 * not fit in one; a `grammar` prompt is a sentence with a ＿ gap and has to
 * wrap. The server says which rather than the client guessing from string
 * length.
 */
export type PromptKind = 'kana' | 'vocab' | 'grammar';

export type Question = {
  exerciseId: string;
  type: 'multipleChoice';
  /** The character or word being asked about. */
  prompt: string;
  promptKind: PromptKind;
  question: string;
  options: ExerciseOption[];
};

/** An object wrapping the array, not a bare array. */
export type ExerciseSet = {
  lessonId: string;
  unit: string;
  title: string;
  attempt: number;
  questionCount: number;
  questions: Question[];
};

/**
 * No answer key is ever sent with the questions — `correct` exists only here,
 * which is why a question cannot be marked without a round trip.
 */
export type AnswerResult = {
  exerciseId: string;
  correct: boolean;
  selectedOptionId: string;
  selectedValue: string | null;
  correctOptionId: string;
  correctValue: string;
  prompt: string;
};

/** Mirrors CompleteLessonResponse in api/src/learning/dto. */
export type CompleteLessonResult = {
  lessonId: string;
  title: string;
  /** Created by this call. Zero on a repeat completion. */
  cardsCreated: number;
  cardsAlreadyPresent: number;
  /** Full award the first time, a smaller practice award on every repeat. */
  xpAwarded: number;
  /** Says which of the two happened — don't infer it from `cardsCreated`. */
  firstCompletion: boolean;
  totalXp: number;
};

/**
 * Generation is seeded by (lesson, user, attempt), so the same `attempt` always
 * returns the same questions in the same order. That is what lets `answer`
 * below re-derive the set server-side instead of storing one.
 */
export function fetchExercises(lessonId: string, attempt: number): Promise<ExerciseSet> {
  return api.get<ExerciseSet>(
    `/lessons/${encodeURIComponent(lessonId)}/exercises?attempt=${attempt}`,
  );
}

/**
 * `exerciseId` is "{attempt}:{index}" — it carries the attempt, so this call
 * needs no attempt of its own. The colon is legal unencoded in a path segment,
 * but it is encoded here so no proxy in front of the API has to have an
 * opinion about it.
 */
export function answerExercise(
  lessonId: string,
  exerciseId: string,
  optionId: string,
): Promise<AnswerResult> {
  return api.post<AnswerResult>(
    `/lessons/${encodeURIComponent(lessonId)}/exercises/${encodeURIComponent(exerciseId)}/answer`,
    { optionId },
  );
}

/** Idempotent for XP. Safe to call again; the award just shrinks. */
export function completeLesson(lessonId: string): Promise<CompleteLessonResult> {
  return api.post<CompleteLessonResult>(`/lessons/${encodeURIComponent(lessonId)}/complete`);
}
