import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/**
 * A day's deliberately fixed study queue. Once generated it is replayed on
 * refresh, rather than re-drawing a moving target as cards become due.
 */
@Schema({ collection: 'dailyStudySessions', timestamps: true })
export class DailyStudySession {
  @Prop({ type: Types.ObjectId, required: true })
  userId: Types.ObjectId;

  /** Local YYYY-MM-DD in the learner's configured time zone. */
  @Prop({ type: String, required: true })
  localDate: string;

  @Prop({ type: [Types.ObjectId], required: true, default: [] })
  cardIds: Types.ObjectId[];

  @Prop({ type: Number, required: true, min: 0 })
  dueCount: number;

  @Prop({ type: Number, required: true, min: 0 })
  newCount: number;
}

export type DailyStudySessionDocument = HydratedDocument<DailyStudySession>;
export const DailyStudySessionSchema = SchemaFactory.createForClass(DailyStudySession);

DailyStudySessionSchema.index({ userId: 1, localDate: 1 }, { unique: true });
