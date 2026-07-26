import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

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
