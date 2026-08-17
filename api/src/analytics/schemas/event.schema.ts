import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/**
 * §5: append-only, write-heavy, never updated. The broad §13 activation and
 * cohort-retention read side remains [Later].
 *
 * Daily progress reads lesson-completion rows; other event families remain
 * write-heavy analytics inputs. `payload` is deliberately unstructured: event shapes change constantly and
 * schema-ing them would make every new event a migration.
 */
@Schema({ collection: 'events', timestamps: false })
export class Event {
  @Prop({ type: Types.ObjectId, required: true })
  userId: Types.ObjectId;

  /** 'lesson.completed', 'chat.turn', and other product events. */
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
// Per-user activity reads use one learner's
EventSchema.index({ userId: 1, type: 1, ts: -1 });
// Funnel queries ("everyone who completed a lesson") span users.
EventSchema.index({ type: 1, ts: -1 });
