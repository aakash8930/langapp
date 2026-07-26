import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/**
 * §8 cost guard's cousin: a cap on how much one person can write in one go.
 * 2000 characters is generous for a chat message and small enough that the
 * collection cannot be filled by a single sender.
 */
export const MAX_MESSAGE_LENGTH = 2000;

/**
 * One direct message between two learners.
 *
 * `pairKey` is the same sorted-id string `Friendship` uses, so a conversation is
 * "every message with this pairKey, oldest first" — one index, no `$or` over
 * sender/recipient, and it lines up with the friendship row that authorises it.
 *
 * `senderId` and `recipientId` are both stored rather than deriving the
 * recipient from the pair: the read path needs to know who wrote each message
 * without parsing a composite string, and `recipientId` is what an unread count
 * would filter on.
 *
 * **Content is never logged.** Same rule the AI chat follows — `GeminiProvider`
 * logs status codes only — and it matters more here, because this text is
 * written by one learner about another.
 */
@Schema({ collection: 'directMessages', timestamps: { createdAt: true, updatedAt: false } })
export class DirectMessage {
  @Prop({ type: String, required: true })
  pairKey: string;

  @Prop({ type: Types.ObjectId, required: true })
  senderId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  recipientId: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true, maxlength: MAX_MESSAGE_LENGTH })
  text: string;

  @Prop({ type: Date, default: null })
  readAt: Date | null;
}

export type DirectMessageDocument = HydratedDocument<DirectMessage>;
export const DirectMessageSchema = SchemaFactory.createForClass(DirectMessage);

// The only read: one conversation, in order.
DirectMessageSchema.index({ pairKey: 1, createdAt: -1 });
// Unread badge: "messages to me I haven't read".
DirectMessageSchema.index({ recipientId: 1, readAt: 1 });
