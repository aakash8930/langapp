import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/**
 * Added in Milestone 6, because "lessons completed" on /me/progress had no
 * source of truth: SrsCards don't record which lesson seeded them, and the
 * `lesson.completed` analytics events are write-only by design (§4) and
 * best-effort, so counting them would be both a boundary violation and
 * occasionally wrong.
 *
 * One row per (user, lesson), so the count is a single indexed query and
 * repeat completions increment a counter rather than adding rows.
 */
@Schema({ collection: 'lessonCompletions', timestamps: false })
export class LessonCompletion {
  @Prop({ type: Types.ObjectId, required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  lessonId: Types.ObjectId;

  @Prop({ type: Number, required: true, default: 1, min: 1 })
  timesCompleted: number;

  @Prop({ type: Date, required: true })
  firstCompletedAt: Date;

  @Prop({ type: Date, required: true })
  lastCompletedAt: Date;
}

export type LessonCompletionDocument = HydratedDocument<LessonCompletion>;
export const LessonCompletionSchema = SchemaFactory.createForClass(LessonCompletion);

// "How many lessons has this user finished" — the /me/progress query.
LessonCompletionSchema.index({ userId: 1 });
// One row per lesson per user; makes the upsert safe under concurrency.
LessonCompletionSchema.index({ userId: 1, lessonId: 1 }, { unique: true });
