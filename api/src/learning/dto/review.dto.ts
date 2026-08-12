import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ResolvedItem } from '../../content/dto/lesson-response.dto';
import { REVIEW_GRADES, ReviewGrade } from '../fsrs-card.mapper';
import { MasteryLevel } from '../schemas/srs-card.schema';

export class GradeReviewDto {
  @IsIn(REVIEW_GRADES, {
    message: `grade must be one of: ${REVIEW_GRADES.join(', ')}`,
  })
  grade: ReviewGrade;

  /** Time taken to review in milliseconds (optional). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  responseTimeMs?: number;
}

/** A due card with its content resolved, ready to render. */
export interface DueCard {
  cardId: string;
  state: string;
  mastery: MasteryLevel;
  due: Date;
  reps: number;
  lapses: number;
  totalReviews: number;
  accuracyRate: number;
  item: ResolvedItem;
}

export interface DueReviewsResponse {
  /** Cards returned in this batch, capped. */
  count: number;
  /** Total due right now, so a client can show "20 of 47". */
  totalDue: number;
  cap: number;
  cards: DueCard[];
}

/** A persisted daily mix of due reviews plus a small number of new cards. */
export interface DailyStudySessionResponse extends DueReviewsResponse {
  localDate: string;
  dueCount: number;
  newCount: number;
}

export interface GradeReviewResponse {
  cardId: string;
  grade: ReviewGrade;
  state: string;
  mastery: MasteryLevel;
  /** When this card comes back. */
  due: Date;
  /** Minutes from now until due — the number a learner actually cares about. */
  intervalMinutes: number;
  reps: number;
  lapses: number;
  totalReviews: number;
  accuracyRate: number;
  xpAwarded: number;
  totalXp: number;
}

/** Exact queue counts at request time. "Overdue" means due before local today. */
export interface ReviewSummaryResponse {
  localDate: string;
  dueNow: number;
  overdue: number;
  states: { new: number; learning: number; review: number; relearning: number };
  totalCards: number;
  estimatedMinutes: number | null;
  timingSamples: number;
}

/** One persisted review. FSRS internals deliberately remain server-only. */
export interface ReviewEventResponse {
  id: string;
  reviewedAt: Date;
  cardId: string | null;
  grade: ReviewGrade | null;
  itemKind: string | null;
  itemId: string | null;
  item: ResolvedItem | null;
  previousState: string | null;
  newState: string | null;
  previousDue: Date | null;
  newDue: Date | null;
  intervalMinutes: number | null;
  responseTimeMs: number | null;
  wasDue: boolean | null;
}

export interface MissedReviewsResponse {
  localDate: string;
  overdueNow: number;
  failedToday: number;
  failedLast7Days: number;
  overdueCards: DueCard[];
  cap: number;
}

export interface ReviewStatisticsResponse {
  days: number;
  reviewsCompleted: number;
  successfulReviews: number;
  observedSuccessRate: number | null;
  averageResponseTimeMs: number | null;
  timingSamples: number;
  grades: Record<ReviewGrade, number>;
  dueNow: number;
  overdueNow: number;
  totalCards: number;
  states: { new: number; learning: number; review: number; relearning: number };
  mastery: Record<MasteryLevel, number>;
}

export interface ReviewRetentionResponse {
  totalCards: number;
  reviewedCards: number;
  predictedRetentionRate: number | null;
  byKind: { kind: string; cards: number; predictedRetentionRate: number }[];
  observedDays: number;
  observedReviews: number;
  observedSuccessRate: number | null;
}

export interface DailyForecastEntry {
  date: string;
  due: number;
  isToday: boolean;
}
