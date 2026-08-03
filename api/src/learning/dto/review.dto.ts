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
