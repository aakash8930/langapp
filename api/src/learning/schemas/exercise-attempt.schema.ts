import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  CONTENT_KINDS,
  ContentKind,
} from '../../knowledge-graph/schemas/knowledge-node.schema';

/**
 * One row per (user, lesson, attempt, exercise). Written by the answer endpoint
 * so the lesson completion gate has a real source of truth for "has the user
 * engaged with this lesson's exercises" — without it, a learner could open a
 * lesson and immediately press /complete for full XP.
 *
 * The collection is owned by `learning`, but the write happens from the
 * `content/exercise` module: that's the only call site that has the data.
 * The cross-module write is documented in `exercise.service.ts` and the
 * modules use forwardRef to resolve the resulting dependency cycle.
 *
 * ## `itemId` / `itemKind` / `exerciseType`
 *
 * Added 2026-07-28 alongside `LearnerItemStateService.record()`. They identify
 * the content item the question was about — the answer endpoint already had
 * them on the in-process `GeneratedQuestion`, and the slice threads them onto
 * the persisted row so `LearnerItemState` evidence can be attributed per item
 * (ADR-003 / §5.2). They are **optional** because every historic row pre-dates
 * the slice and backfilling them would require regenerating every past set
 * against content that has since changed (see `learner-item-state.service.ts`).
 */
@Schema({ collection: 'exerciseAttempts', timestamps: { createdAt: 'answeredAt', updatedAt: false } })
export class ExerciseAttempt {
  @Prop({ type: Types.ObjectId, required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  lessonId: Types.ObjectId;

  /** The attempt number the exercise was generated under — from the exerciseId. */
  @Prop({ type: Number, required: true, min: 0 })
  attempt: number;

  /** The exerciseId carrying {attempt}:{index}. Redundant with `attempt` + position, but stored so the row is self-contained for analytics. */
  @Prop({ type: String, required: true })
  exerciseId: string;

  @Prop({ type: Boolean, required: true })
  correct: boolean;

  /** Response time in milliseconds (optional). */
  @Prop({ type: Number, default: null, min: 0 })
  responseTimeMs: number | null;

  /**
   * The content item the question asked about. `null` on every row written
   * before the learner-model write-path slice landed.
   */
  @Prop({ type: Types.ObjectId, required: false, default: null })
  itemId: Types.ObjectId | null;

  /**
   * The item's `kind` in the `SrsItemRef` sense — same enum `SrsCard.itemRef`
   * uses, so `(itemKind, itemId)` can be matched against `learnerItemStates`
   * and `srsCards` without translation. `'wordReading'` is mapped to `'vocab'`
   * at write time (the existing `promptKindToSrsKind` helper), so this
   * column never carries `'wordReading'`.
   */
  @Prop({ type: String, required: false, default: null, enum: CONTENT_KINDS })
  itemKind: ContentKind | null;

  /**
   * The exercise type — `multipleChoice`, `wordReading`, or whatever a future
   * plugin registers. Kept as a string rather than narrowed to the current
   * `ExerciseType` union because the value here is what `LearnerItemState`
   * keys its `byExerciseType` map on, and exercise types are a plugin point.
   */
  @Prop({ type: String, required: false, default: null })
  exerciseType: string | null;
}

export type ExerciseAttemptDocument = HydratedDocument<ExerciseAttempt>;
export const ExerciseAttemptSchema = SchemaFactory.createForClass(ExerciseAttempt);

// The completion gate is "has this user answered anything for this lesson?"
// — counted with `countDocuments({ userId, lessonId })`. Compound index makes
// the read O(1) and keeps the collection usable as a per-user history.
ExerciseAttemptSchema.index({ userId: 1, lessonId: 1 });

// One row per (user, lesson, attempt, exercise). Re-answering the same question
// in the same attempt is a no-op (the answer endpoint is idempotent on the read
// path), and the unique index is what makes that property structural rather
// than something the code could quietly lose.
ExerciseAttemptSchema.index(
  { userId: 1, lessonId: 1, attempt: 1, exerciseId: 1 },
  { unique: true },
);
