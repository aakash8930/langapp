import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/**
 * "I do not want to hear from this person."
 *
 * Deliberately **one-directional and asymmetric in effect**: the row records who
 * blocked whom, but every check treats a block in *either* direction as
 * disqualifying. So blocking someone also stops them contacting you, which is
 * the only behaviour a blocker expects — a block that merely hides their
 * messages from you while yours still reach them is not a block.
 *
 * Kept as its own collection rather than an array on the user because it is
 * queried from the other side ("has X blocked me?"), which an embedded array
 * cannot index usefully.
 */
@Schema({ collection: 'blocks', timestamps: { createdAt: true, updatedAt: false } })
export class Block {
  /** The person who blocked. */
  @Prop({ type: Types.ObjectId, required: true })
  userId: Types.ObjectId;

  /** The person blocked. */
  @Prop({ type: Types.ObjectId, required: true })
  blockedUserId: Types.ObjectId;
}

export type BlockDocument = HydratedDocument<Block>;
export const BlockSchema = SchemaFactory.createForClass(Block);

// Blocking twice is a no-op, not an error — the unique index is what makes that
// true without a read-then-write race.
BlockSchema.index({ userId: 1, blockedUserId: 1 }, { unique: true });
// "Has anyone blocked me?" — the direction the send path checks.
BlockSchema.index({ blockedUserId: 1 });
