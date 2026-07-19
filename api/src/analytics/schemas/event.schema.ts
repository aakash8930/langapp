import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/**
 * §5: append-only, write-heavy, never updated. This is the write side of §13
 * item 3 — the read side (activation funnel, retention) is [Later].
 *
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

// §5: "this user's recent events, newest first" is the only read pattern.
EventSchema.index({ userId: 1, ts: -1 });
// Funnel queries ("everyone who completed a lesson") span users.
EventSchema.index({ type: 1, ts: -1 });
