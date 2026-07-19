import { Card, createEmptyCard, Grade, Rating, State } from 'ts-fsrs';
import { SrsCardDocument, SrsState } from './schemas/srs-card.schema';

/**
 * ts-fsrs and §5 disagree on shape: ts-fsrs uses snake_case with a numeric
 * `state` enum, §5 specifies camelCase with string states. §5 is the storage
 * spec, so the database keeps §5's shape and the translation happens here —
 * the single point where the library's representation meets ours.
 *
 * §5 plus one field: `learningSteps`. See the schema for why it's mandatory.
 */

const STATE_TO_STRING: Record<State, SrsState> = {
  [State.New]: 'new',
  [State.Learning]: 'learning',
  [State.Review]: 'review',
  [State.Relearning]: 'relearning',
};

const STRING_TO_STATE: Record<SrsState, State> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
};

export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy';
export const REVIEW_GRADES: ReviewGrade[] = ['again', 'hard', 'good', 'easy'];

/**
 * `Grade` is ts-fsrs's `Rating` minus `Manual` — the four a learner can
 * actually give. Typing the map to `Grade` keeps `Manual` (which would mean
 * "reschedule by hand", not "I recalled this") out of the review path.
 */
const GRADE_TO_RATING: Record<ReviewGrade, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

export function gradeToRating(grade: ReviewGrade): Grade {
  return GRADE_TO_RATING[grade];
}

/** The §5-shaped subset of a card that scheduling actually changes. */
export interface SchedulingFields {
  stability: number;
  difficulty: number;
  due: Date;
  lastReview: Date | null;
  reps: number;
  lapses: number;
  state: SrsState;
  learningSteps: number;
}

/**
 * A brand-new card, initialised by ts-fsrs rather than by hand so the zero
 * values match what the scheduler expects at first review.
 */
export function newCardFields(now: Date): SchedulingFields {
  return fromFsrsCard(createEmptyCard(now));
}

/**
 * Rebuild the library's Card from what we stored.
 *
 * `elapsed_days` and `scheduled_days` are *not* stored — they're derivable, so
 * deriving them is cheaper than a migration and can't drift out of sync with
 * `due`/`lastReview`. `learning_steps` is the one that can't be derived, which
 * is exactly why it's on the schema.
 */
export function toFsrsCard(card: SrsCardDocument, now: Date): Card {
  const lastReview = card.lastReview ?? undefined;

  return {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: lastReview ? daysBetween(lastReview, now) : 0,
    scheduled_days: lastReview ? daysBetween(lastReview, card.due) : 0,
    learning_steps: card.learningSteps,
    reps: card.reps,
    lapses: card.lapses,
    state: STRING_TO_STATE[card.state],
    last_review: lastReview,
  };
}

export function fromFsrsCard(card: Card): SchedulingFields {
  return {
    stability: card.stability,
    difficulty: card.difficulty,
    due: card.due,
    lastReview: card.last_review ?? null,
    reps: card.reps,
    lapses: card.lapses,
    state: STATE_TO_STRING[card.state],
    learningSteps: card.learning_steps,
  };
}

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 86_400_000));
}
