import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/** §7 step 5's {span, fix, note} — a correction of something the learner wrote. */
@Schema({ _id: false })
export class ChatCorrection {
  /** Exact substring of the learner's message that was wrong. */
  @Prop({ type: String, required: true })
  span: string;

  @Prop({ type: String, required: true })
  fix: string;

  /** One short English sentence explaining why. */
  @Prop({ type: String, required: true })
  note: string;
}

const ChatCorrectionSchema = SchemaFactory.createForClass(ChatCorrection);

/**
 * §5 ChatMessage. `audioKey` is deliberately absent until voice exists — a
 * field nothing writes is a field that rots. Corrections live on the *user*
 * message they annotate; assistant messages always store an empty array.
 */
@Schema({ collection: 'chatMessages', timestamps: false })
export class ChatMessage {
  @Prop({ type: Types.ObjectId, required: true })
  sessionId: Types.ObjectId;

  @Prop({ type: String, required: true, enum: ['user', 'assistant'] })
  role: 'user' | 'assistant';

  @Prop({ type: String, required: true })
  text: string;

  @Prop({ type: [ChatCorrectionSchema], default: [] })
  corrections: ChatCorrection[];

  @Prop({ type: Date, required: true, default: () => new Date() })
  createdAt: Date;
}

export type ChatMessageDocument = HydratedDocument<ChatMessage>;
export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);

// "This session's transcript, in order" is the hottest query. _id breaks ties
// when two messages land in the same millisecond (user + reply are written
// back-to-back).
ChatMessageSchema.index({ sessionId: 1, createdAt: 1, _id: 1 });
