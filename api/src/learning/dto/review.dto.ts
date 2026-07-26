import { IsIn } from 'class-validator';
import { ResolvedItem } from '../../content/dto/lesson-response.dto';
import { REVIEW_GRADES, ReviewGrade } from '../fsrs-card.mapper';

export class GradeReviewDto {
  @IsIn(REVIEW_GRADES, {
    message: `grade must be one of: ${REVIEW_GRADES.join(', ')}`,
  })
  grade: ReviewGrade;
}

/** A due card with its content resolved, ready to render. */
export interface DueCard {
  cardId: string;
  state: string;
  due: Date;
  reps: number;
  lapses: number;
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

export interface GradeReviewResponse {
  cardId: string;
  grade: ReviewGrade;
  state: string;
  /** When this card comes back. */
  due: Date;
  /** Minutes from now until due — the number a learner actually cares about. */
  intervalMinutes: number;
  reps: number;
  lapses: number;
  xpAwarded: number;
  totalXp: number;
}
