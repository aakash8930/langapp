import { api } from './client';
import type { AnswerResult, ExerciseOption, PromptKind } from './exercises';

/** Mirrors api/src/content/dto/checkpoint-response.dto.ts. */

/**
 * A checkpoint question. The same field names a lesson `Question` carries, so
 * `QuestionPrompt` and `OptionButton` render either without a translation step.
 *
 * `type` is a bare string rather than a union: the server sends whatever
 * exercise type the unit teaches, and a plugin type added server-side must not
 * stop this app compiling before anyone has decided how to draw it. The screen
 * shows an explicit "needs a newer version" state for a type it does not know,
 * which is better than a blank card.
 */
export type CheckpointQuestion = {
  exerciseId: string;
  itemId: string;
  type: string;
  prompt: string;
  promptKind: PromptKind;
  question: string;
  /** Absent for typed questions. */
  options?: ExerciseOption[];
};

export type CheckpointSet = {
  unit: string;
  attempt: number;
  questionCount: number;
  /** The fraction needed to pass. Read it — never hard-code 0.8 in this app. */
  passMark: number;
  questions: CheckpointQuestion[];
};

/** One missed item and its answer. Only ever present after submit. */
export type CheckpointMiss = {
  itemId: string;
  prompt: string;
  promptKind: PromptKind;
  correctValue: string;
  /** False when the learner never reached it — left early rather than got it wrong. */
  answered: boolean;
};

export type CheckpointResult = {
  unit: string;
  attempt: number;
  questionCount: number;
  correctCount: number;
  /** Fraction 0..1. */
  score: number;
  passMark: number;
  passed: boolean;
  xpAwarded: number;
  missed: CheckpointMiss[];
  /** How many items were pulled forward in the SRS. Always `missed.length`. */
  scheduledForReview: number;
};

/**
 * Start the unit checkpoint, or resume the one already open.
 *
 * **Calling this twice does not create two tests.** The server returns the open
 * attempt unchanged until it is submitted — which is what stops a learner
 * abandoning a hard draw and re-rolling for an easier one, and also means
 * backgrounding the app mid-test and coming back lands on the same questions.
 *
 * `POST`, not `GET`, because starting creates an attempt server-side. The
 * attempt number comes back on the response; this app never chooses one, unlike
 * `fetchExercises` where the attempt is the client's to pick.
 */
export function startCheckpoint(unit: string): Promise<CheckpointSet> {
  return api.post<CheckpointSet>(`/units/${encodeURIComponent(unit)}/checkpoint`);
}

/**
 * Answer one question, once.
 *
 * The result's `correctValue` and `correctOptionId` come back **empty** — a test
 * does not reveal the answer while it is running, because a later question can
 * be about the same item. They arrive at submit, in `missed`. Do not build a
 * feedback panel from this response; it has nothing to put in one.
 *
 * A second answer to the same question returns the stored verdict rather than
 * an error, so a double tap is safe and cannot overwrite a wrong answer.
 *
 * `responseTimeMs` is sent because the server's confidence model weights how
 * long an answer took. Optional on the wire.
 */
export function answerCheckpoint(
  unit: string,
  attempt: number,
  exerciseId: string,
  body: ({ optionId: string } | { text: string }) & { responseTimeMs?: number },
): Promise<AnswerResult> {
  return api.post<AnswerResult>(
    `/units/${encodeURIComponent(unit)}/checkpoint/${attempt}/answer/${encodeURIComponent(exerciseId)}`,
    body,
  );
}

/**
 * Close the attempt and get the verdict.
 *
 * Idempotent: submitting again returns the same score with `xpAwarded: 0`, so a
 * retry after a timeout cannot pay out twice and needs no guard here.
 */
export function submitCheckpoint(unit: string, attempt: number): Promise<CheckpointResult> {
  return api.post<CheckpointResult>(
    `/units/${encodeURIComponent(unit)}/checkpoint/${attempt}/submit`,
  );
}
