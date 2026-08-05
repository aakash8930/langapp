import { api } from './client';
import type { AnswerResult, ExerciseOption, PromptKind } from './exercises';

/** Mirrors api/src/content/combined-test/combined-test.service.ts. */

/**
 * The combined test question — the same shape a checkpoint question has, so
 * `QuestionPrompt` and `OptionButton` render either without a translation step.
 *
 * `type` is a bare string rather than a union: the server sends whatever
 * exercise type the freshest finished unit teaches, and a plugin type added
 * server-side must not stop this app compiling before anyone has decided
 * how to draw it.
 */
export type CombinedTestQuestion = {
  exerciseId: string;
  itemId: string;
  type: string;
  prompt: string;
  promptKind: PromptKind;
  question: string;
  /** Absent for typed questions. */
  options?: ExerciseOption[];
};

export type CombinedTestSet = {
  kind: 'combined';
  /** Every finished unit this test covers, in the order the API returns them. */
  unitSlugs: string[];
  attempt: number;
  questionCount: number;
  /** The fraction needed to pass. Read it — never hard-code 0.8 in this app. */
  passMark: number;
  questions: CombinedTestQuestion[];
};

/** One missed item and its answer. Only ever present after submit. */
export type CombinedTestMiss = {
  itemId: string;
  prompt: string;
  promptKind: PromptKind;
  correctValue: string;
  /** False when the learner never reached it — left early rather than got it wrong. */
  answered: boolean;
};

export type CombinedTestResult = {
  kind: 'combined';
  unitSlugs: string[];
  attempt: number;
  questionCount: number;
  correctCount: number;
  /** Fraction 0..1. */
  score: number;
  passMark: number;
  passed: boolean;
  xpAwarded: number;
  missed: CombinedTestMiss[];
  /** How many items were pulled forward in the SRS. Always `missed.length`. */
  scheduledForReview: number;
};

/**
 * Start the combined test, or resume the one already open.
 *
 * Same resume-not-regenerate contract as `startCheckpoint`: calling twice
 * does not create a second test, the server returns the open attempt
 * unchanged. The marker is the hash of the finished-unit list, so adding
 * another finished unit issues a fresh attempt rather than resuming.
 *
 * `POST`, not `GET`, because starting creates an attempt server-side.
 */
export function startCombinedTest(): Promise<CombinedTestSet> {
  return api.post<CombinedTestSet>('/combined-test');
}

/**
 * Answer one question, once.
 *
 * The result's `correctValue` and `correctOptionId` come back **empty** —
 * the answer key arrives in `missed` at submit. The mid-test withhold is
 * the same as the per-unit checkpoint's, for the same reason: a later
 * question can be about the same item.
 */
export function answerCombinedTest(
  attempt: number,
  exerciseId: string,
  body: ({ optionId: string } | { text: string }) & { responseTimeMs?: number },
): Promise<AnswerResult> {
  return api.post<AnswerResult>(
    `/combined-test/${attempt}/answer/${encodeURIComponent(exerciseId)}`,
    body,
  );
}

/**
 * Close the attempt and get the verdict.
 *
 * Idempotent: submitting again returns the same score with `xpAwarded: 0`,
 * so a retry after a timeout cannot pay out twice and needs no guard
 * here.
 */
export function submitCombinedTest(attempt: number): Promise<CombinedTestResult> {
  return api.post<CombinedTestResult>(`/combined-test/${attempt}/submit`);
}