import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/** §5 ChatSession, verbatim: { userId, scenario, startedAt }. */
@Schema({ collection: 'chatSessions', timestamps: false })
export class ChatSession {
  @Prop({ type: Types.ObjectId, required: true })
  userId: Types.ObjectId;

  /** Scenario id from the ai-orchestrator registry, e.g. 'first-meeting'. */
  @Prop({ type: String, required: true, trim: true })
  scenario: string;

  @Prop({ type: Date, required: true, default: () => new Date() })
  startedAt: Date;
}

export type ChatSessionDocument = HydratedDocument<ChatSession>;
export const ChatSessionSchema = SchemaFactory.createForClass(ChatSession);

// "This user's sessions, newest first" — the only cross-session read pattern.
ChatSessionSchema.index({ userId: 1, startedAt: -1 });
