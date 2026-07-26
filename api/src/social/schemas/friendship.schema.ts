import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const FRIENDSHIP_STATUSES = ['pending', 'accepted'] as const;
export type FriendshipStatus = (typeof FRIENDSHIP_STATUSES)[number];

/**
 * One friendship, in one row, whichever direction it was requested in.
 *
 * ## The pair key
 *
 * `pairKey` is the two user ids sorted and joined — so A→B and B→A produce the
 * same string, and a unique index on it makes "you cannot be friends twice"
 * structural rather than a check someone can forget. Without it, A requesting B
 * while B requests A creates two rows that then disagree about status.
 *
 * `requesterId`/`addresseeId` are kept alongside because direction still matters
 * while the request is `pending`: only the addressee may accept it, and the
 * requester should not see their own outgoing request in their inbox.
 *
 * ## No 'declined' status
 *
 * Declining deletes the row. A stored decline would either block the pair from
 * ever trying again, or need an expiry rule — and it also tells the requester
 * they were refused, which is a small unkindness with no upside. Deleting means
 * a later request simply works.
 */
@Schema({ collection: 'friendships', timestamps: true })
export class Friendship {
  @Prop({ type: Types.ObjectId, required: true })
  requesterId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  addresseeId: Types.ObjectId;

  /** Sorted `${a}:${b}` — see the note above. */
  @Prop({ type: String, required: true })
  pairKey: string;

  @Prop({ type: String, required: true, enum: FRIENDSHIP_STATUSES, default: 'pending' })
  status: FriendshipStatus;

  @Prop({ type: Date, default: null })
  respondedAt: Date | null;
}

export type FriendshipDocument = HydratedDocument<Friendship>;
export const FriendshipSchema = SchemaFactory.createForClass(Friendship);

/** One friendship per pair, in either direction. The guarantee, not an optimisation. */
FriendshipSchema.index({ pairKey: 1 }, { unique: true });
// "My friends" and "my incoming requests" — the two reads the UI makes.
FriendshipSchema.index({ requesterId: 1, status: 1 });
FriendshipSchema.index({ addresseeId: 1, status: 1 });

/**
 * The canonical key for a pair, order-independent.
 *
 * Exported because both the service and its tests need to agree on it, and a
 * second implementation is exactly how the uniqueness guarantee would get lost.
 */
export function pairKeyFor(a: string, b: string): string {
  return [a, b].sort().join(':');
}
