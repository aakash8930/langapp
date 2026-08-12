import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/**
 * §5: append-only, write-heavy, never updated. The broad §13 activation and
 * cohort-retention read side remains [Later].
 *
 * The Review System reads `review.graded` rows for learner-facing history
 * and aggregates; other event families remain write-heavy analytics inputs.
 * `payload` is deliberately unstructured: event shapes change constantly and
 * schema-ing them would make every new event a migration.
 */
@Schema({ collection: 'events', timestamps: false })
export class Event {
  @Prop({ type: Types.ObjectId, required: true })
  userId: Types.ObjectId;

  /** 'lesson.completed', 'review.graded', 'chat.turn' */
  @Prop({ type: String, required: true, trim: true })
  type: string;

  @Prop({ type: Object, default: {} })
  payload: Record<string, unknown>;

  @Prop({ type: Date, required: true, default: () => new Date() })
  ts: Date;
}

export type EventDocument = HydratedDocument<Event>;
export const EventSchema = SchemaFactory.createForClass(Event);

// §5: "this user's recent events, newest first" is the general read pattern.
EventSchema.index({ userId: 1, ts: -1 });
// Review history, heatmap, statistics and retention all read one learner's
// review.graded window. Keep that filter and newest-first sort index-covered.
EventSchema.index({ userId: 1, type: 1, ts: -1 });
// Funnel queries ("everyone who completed a lesson") span users.
EventSchema.index({ type: 1, ts: -1 });
