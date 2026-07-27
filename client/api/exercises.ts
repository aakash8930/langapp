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
 * wrap; a `wordReading` prompt is a word and behaves like `vocab` for sizing.
 * The server says which rather than the client guessing from string length.
 */
export type PromptKind = 'kana' | 'vocab' | 'grammar' | 'wordReading' | 'kanji';

/**
 * The content item behind the prompt — the same `id` `GET /lessons/:id` returns.
 *
 * `exerciseId` is a position in a shuffle and changes between attempts, so this
 * is the only stable per-item handle. For vocabulary it is what
 * `audioUrlForVocab` needs, which is how a quiz question can speak.
 *
 * Sent for every `promptKind`, including the ones with no audio — deciding
 * *which* prompts can speak is this client's job, not the server's. Check
 * `promptKind` before offering playback; a kana or kanji id has no `.wav` and
 * would 404.
 */
type ItemId = string;

export type MultipleChoiceQuestion = {
  exerciseId: string;
  itemId: ItemId;
  type: 'multipleChoice';
  /** The character or word being asked about. */
  prompt: string;
  promptKind: PromptKind;
  question: string;
  options: ExerciseOption[];
};

/**
 * A typing question. The prompt is the word the learner reads; the answer is
 * the romaji they type. No options — the API never sends them for this
 * shape. The grader is exact-match with case + whitespace normalised.
 */
export type WordReadingQuestion = {
  exerciseId: string;
  itemId: ItemId;
  type: 'wordReading';
  prompt: string;
  promptKind: PromptKind;
  question: string;
};

export type Question = MultipleChoiceQuestion | WordReadingQuestion;

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
 *
 * `selectedOptionId` and `correctOptionId` carry an `opt-N` for multipleChoice
 * and an empty string for wordReading. The typed input is in `selectedValue`.
 */
export type AnswerResult = {
  exerciseId: string;
  correct: boolean;
  selectedOptionId: string;
  selectedValue: string | null;
  correctOptionId: string;
  correctValue: string;
  prompt: string;
  /**
   * Hearts left after this answer, or null meaning "leave the counter alone".
   *
   * Null covers a correct answer (nothing charged) *and* a charge that failed
   * server-side — both mean this response established no new number, so
   * rendering one would risk disagreeing with `/me/progress`.
   */
  heartsLeft: number | null;
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
  /** Gems, following the same full-then-practice shape as `xpAwarded`. */
  gemsAwarded: number;
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
 *
 * The body shape depends on the lesson's exercise type:
 *   - `multipleChoice` — pass `{ optionId: 'opt-N' }`.
 *   - `wordReading` — pass `{ text: 'gakkou' }`.
 *
 * The server enforces this — sending the wrong field is a 400 — so the
 * caller passes the right one for the question they are answering.
 */
export function answerExercise(
  lessonId: string,
  exerciseId: string,
  body: { optionId: string } | { text: string },
): Promise<AnswerResult> {
  return api.post<AnswerResult>(
    `/lessons/${encodeURIComponent(lessonId)}/exercises/${encodeURIComponent(exerciseId)}/answer`,
    body,
  );
}

/** Idempotent for XP. Safe to call again; the award just shrinks. */
export function completeLesson(lessonId: string): Promise<CompleteLessonResult> {
  return api.post<CompleteLessonResult>(`/lessons/${encodeURIComponent(lessonId)}/complete`);
}
