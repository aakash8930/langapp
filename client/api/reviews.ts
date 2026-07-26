import { api } from './client';
import type { ResolvedItem } from './items';

/** Mirrors the interfaces in api/src/learning/dto/review.dto.ts. */

export const REVIEW_GRADES = ['again', 'hard', 'good', 'easy'] as const;
export type ReviewGrade = (typeof REVIEW_GRADES)[number];

/** Where the card sits in the FSRS lifecycle. Safe to show; not scheduling math. */
export type CardState = 'new' | 'learning' | 'review' | 'relearning';

export type DueCard = {
  cardId: string;
  state: CardState;
  /** ISO 8601 — JSON has no Date, whatever the server's DTO says. */
  due: string;
  reps: number;
  lapses: number;
  item: ResolvedItem;
};

export type DueReviews = {
  /** Cards in this batch, capped. */
  count: number;
  /** True number due right now, so a session can say "20 of 47". */
  totalDue: number;
  cap: number;
  cards: DueCard[];
};

/**
 * Mirrors the server's `GradeReviewResponse`. The leak rule in the root
 * CLAUDE.md says FSRS internals (stability, difficulty) must not reach a
 * client; this type does not declare them, so they cannot be rendered.
 */
export type GradeResult = {
  cardId: string;
  grade: ReviewGrade;
  state: CardState;
  due: string;
  /** Minutes from now until the card returns — the number a learner cares about. */
  intervalMinutes: number;
  reps: number;
  lapses: number;
  xpAwarded: number;
  totalXp: number;
};

export function fetchDueReviews(): Promise<DueReviews> {
  return api.get<DueReviews>('/reviews/due');
}

/**
 * XP is due-gated server-side: grading a card that was not actually due
 * reschedules it but awards nothing, so `xpAwarded` can legitimately be 0.
 */
export function gradeReview(cardId: string, grade: ReviewGrade): Promise<GradeResult> {
  return api.post<GradeResult>(`/reviews/${encodeURIComponent(cardId)}/grade`, { grade });
}
