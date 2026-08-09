import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NotificationService } from '../notification/notification.service';
import { UserService } from '../user/user.service';
import { meetsMinimumAge, MIN_AGE_FOR_MESSAGING } from '../user/gamification/age';
import { Block, BlockDocument } from './schemas/block.schema';
import { DirectMessage, DirectMessageDocument } from './schemas/direct-message.schema';
import { Friendship, FriendshipDocument, pairKeyFor } from './schemas/friendship.schema';
import { Report, ReportDocument, ReportReason } from './schemas/report.schema';

/** How many people a search returns. Enough to find someone, not enough to scrape. */
const SEARCH_LIMIT = 20;

/** Messages returned per conversation read, newest first. */
const MESSAGE_PAGE = 50;

export interface PublicProfile {
  id: string;
  displayName: string;
  /** Shown so a learner can tell two people with the same name apart. */
  level: number;
  xp: number;
  streakDays: number;
}

/**
 * Owns `friendships`, `directMessages`, `blocks` and `reports`.
 *
 * ## The safety model, in one place
 *
 * Four rules, all enforced here rather than in the controller, so no future
 * route can bypass them by forgetting a check:
 *
 * 1. **Messages require an accepted friendship.** There is no route by which a
 *    stranger can open a conversation. This is the single largest reduction in
 *    risk for an app that will have minors on it, and it is why the age gate is
 *    13 rather than 18 — the protection is structural, not age-segregating.
 * 2. **A block in either direction disqualifies everything** — messaging, friend
 *    requests, and appearing in search. A block that only hides their messages
 *    from you while yours still reach them is not a block.
 * 3. **Messaging requires a known age at or over the minimum.** An account with
 *    no `dateOfBirth` (the ones predating the gate) cannot message until it has
 *    one. Unknown fails closed.
 * 4. **You cannot befriend, message, block or report yourself.** Cheap to check
 *    and every one of them corrupts an invariant if allowed.
 */
@Injectable()
export class SocialService {
  constructor(
    @InjectModel(Friendship.name) private readonly friendshipModel: Model<FriendshipDocument>,
    @InjectModel(DirectMessage.name) private readonly messageModel: Model<DirectMessageDocument>,
    @InjectModel(Block.name) private readonly blockModel: Model<BlockDocument>,
    @InjectModel(Report.name) private readonly reportModel: Model<ReportDocument>,
    private readonly userService: UserService,
    private readonly notifications: NotificationService,
  ) {}

  // -------------------------------------------------------------------------
  // Finding people
  // -------------------------------------------------------------------------

  /**
   * Search by display name.
   *
   * **Never by email.** Searching by email would turn this into an oracle for
   * "does this address have an account", which is the exact enumeration the
   * login route goes out of its way to prevent by answering 401 for both an
   * unknown email and a wrong password.
   *
   * Blocked users in either direction are filtered out, so a blocked person
   * cannot find their way back to you through search.
   */
  async searchUsers(viewerId: string, query: string): Promise<PublicProfile[]> {
    const trimmed = query.trim();
    // A blank query would return an arbitrary slice of the user base — a
    // directory, not a search.
    if (trimmed.length < 2) {
      return [];
    }

    const hidden = await this.blockedEitherWay(viewerId);
    hidden.add(viewerId);

    const users = await this.userService.searchByDisplayName(
      trimmed,
      [...hidden],
      SEARCH_LIMIT,
    );

    return users.map((user) => this.userService.toPublicProfile(user));
  }

  // -------------------------------------------------------------------------
  // Friendships
  // -------------------------------------------------------------------------

  async sendFriendRequest(viewerId: string, targetId: string): Promise<{ status: string }> {
    this.assertNotSelf(viewerId, targetId, 'befriend');
    await this.assertExists(targetId);
    await this.assertNotBlocked(viewerId, targetId);

    const pairKey = pairKeyFor(viewerId, targetId);
    const existing = await this.friendshipModel.findOne({ pairKey }).exec();

    if (existing) {
      if (existing.status === 'accepted') {
        throw new ConflictException('You are already friends');
      }
      // They asked first and this is effectively an accept — treat it as one
      // rather than making two people stare at each other's pending requests.
      if (existing.addresseeId.toString() === viewerId) {
        return this.respondToRequest(viewerId, existing._id.toString(), true);
      }
      throw new ConflictException('Your request is already pending');
    }

    try {
      await this.friendshipModel.create({
        requesterId: new Types.ObjectId(viewerId),
        addresseeId: new Types.ObjectId(targetId),
        pairKey,
        status: 'pending',
      });
    } catch (err) {
      // Two simultaneous requests between the same pair. The unique index on
      // pairKey is what makes this safe; one of them simply loses.
      if (isDuplicateKeyError(err)) {
        throw new ConflictException('A request between you already exists');
      }
      throw err;
    }

    // Notify the target about the friend request
    const requester = await this.userService.findById(viewerId);
    if (requester) {
      this.notifications.create({
        userId: targetId,
        type: 'community',
        title: 'New Friend Request',
        body: `${requester.profile.displayName} sent you a friend request.`,
        metadata: { requesterId: viewerId, requesterName: requester.profile.displayName },
      }).catch(() => {});
    }

    return { status: 'pending' };
  }

  /** Accept or decline. Only the addressee may — the requester accepting their own would be absurd. */
  async respondToRequest(
    viewerId: string,
    requestId: string,
    accept: boolean,
  ): Promise<{ status: string }> {
    if (!Types.ObjectId.isValid(requestId)) {
      throw new NotFoundException('Request not found');
    }

    const request = await this.friendshipModel.findById(requestId).exec();
    // 404 rather than 403 for someone else's request: whether it exists is not
    // information a third party is entitled to.
    if (!request || request.addresseeId.toString() !== viewerId) {
      throw new NotFoundException('Request not found');
    }
    if (request.status === 'accepted') {
      throw new ConflictException('You are already friends');
    }

    if (!accept) {
      // Deleted, not marked declined — see the note on the schema.
      await this.friendshipModel.deleteOne({ _id: request._id }).exec();
      return { status: 'declined' };
    }

    await this.friendshipModel
      .updateOne({ _id: request._id }, { $set: { status: 'accepted', respondedAt: new Date() } })
      .exec();

    // Notify the original requester that their request was accepted
    const accepter = await this.userService.findById(viewerId);
    if (accepter) {
      this.notifications.create({
        userId: request.requesterId.toString(),
        type: 'community',
        title: 'Friend Request Accepted',
        body: `${accepter.profile.displayName} accepted your friend request.`,
        metadata: { accepterId: viewerId, accepterName: accepter.profile.displayName },
      }).catch(() => {});
    }

    return { status: 'accepted' };
  }

  async listFriends(viewerId: string): Promise<PublicProfile[]> {
    const id = new Types.ObjectId(viewerId);
    const rows = await this.friendshipModel
      .find({ status: 'accepted', $or: [{ requesterId: id }, { addresseeId: id }] })
      .exec();

    const otherIds = rows.map((row) =>
      row.requesterId.toString() === viewerId
        ? row.addresseeId.toString()
        : row.requesterId.toString(),
    );

    const users = await this.userService.findManyByIds(otherIds);
    return users.map((user) => this.userService.toPublicProfile(user));
  }

  /** Incoming requests only — an outgoing one is not something to action. */
  async listIncomingRequests(
    viewerId: string,
  ): Promise<{ requestId: string; from: PublicProfile }[]> {
    const rows = await this.friendshipModel
      .find({ addresseeId: new Types.ObjectId(viewerId), status: 'pending' })
      .exec();

    const users = await this.userService.findManyByIds(
      rows.map((row) => row.requesterId.toString()),
    );
    const byId = new Map(users.map((user) => [user._id.toString(), user]));

    return rows
      .map((row) => {
        const from = byId.get(row.requesterId.toString());
        return from
          ? { requestId: row._id.toString(), from: this.userService.toPublicProfile(from) }
          : null;
      })
      .filter((row): row is { requestId: string; from: PublicProfile } => row !== null);
  }

  async removeFriend(viewerId: string, targetId: string): Promise<void> {
    await this.friendshipModel.deleteOne({ pairKey: pairKeyFor(viewerId, targetId) }).exec();
  }

  // -------------------------------------------------------------------------
  // Messages
  // -------------------------------------------------------------------------

  async sendMessage(
    viewerId: string,
    targetId: string,
    text: string,
  ): Promise<{ id: string; text: string; createdAt: Date }> {
    this.assertNotSelf(viewerId, targetId, 'message');
    await this.assertMayMessage(viewerId, targetId);

    const trimmed = text.trim();
    if (trimmed.length === 0) {
      throw new BadRequestException('A message cannot be empty');
    }

    const message = await this.messageModel.create({
      pairKey: pairKeyFor(viewerId, targetId),
      senderId: new Types.ObjectId(viewerId),
      recipientId: new Types.ObjectId(targetId),
      text: trimmed,
    });

    // Notify the recipient of the new message
    const sender = await this.userService.findById(viewerId);
    if (sender) {
      this.notifications.create({
        userId: targetId,
        type: 'community',
        title: 'New Message',
        body: `${sender.profile.displayName}: ${trimmed.slice(0, 100)}${trimmed.length > 100 ? '...' : ''}`,
        metadata: { senderId: viewerId, senderName: sender.profile.displayName },
      }).catch(() => {});
    }

    return {
      id: message._id.toString(),
      text: message.text,
      createdAt: message.get('createdAt') as Date,
    };
  }

  /**
   * One conversation, newest first.
   *
   * Re-checks the friendship rather than trusting that it existed when the
   * messages were written: unfriending or blocking must close the history, not
   * just stop new messages.
   */
  async listMessages(viewerId: string, targetId: string) {
    this.assertNotSelf(viewerId, targetId, 'message');
    await this.assertMayMessage(viewerId, targetId);

    const rows = await this.messageModel
      .find({ pairKey: pairKeyFor(viewerId, targetId) })
      .sort({ createdAt: -1 })
      .limit(MESSAGE_PAGE)
      .exec();

    // Mark what the viewer received as read. Fire-and-forget: a failed read
    // receipt must not fail the read.
    await this.messageModel
      .updateMany(
        { pairKey: pairKeyFor(viewerId, targetId), recipientId: new Types.ObjectId(viewerId), readAt: null },
        { $set: { readAt: new Date() } },
      )
      .exec()
      .catch(() => undefined);

    return rows.reverse().map((row) => ({
      id: row._id.toString(),
      text: row.text,
      mine: row.senderId.toString() === viewerId,
      createdAt: row.get('createdAt') as Date,
    }));
  }

  // -------------------------------------------------------------------------
  // Blocking and reporting
  // -------------------------------------------------------------------------

  /**
   * Block someone, and drop any friendship with them in the same breath.
   *
   * Leaving the friendship in place would mean a blocked person still counted as
   * a friend, which is both wrong on its face and would let them back in the
   * moment the block was lifted without a fresh request.
   */
  async blockUser(viewerId: string, targetId: string): Promise<void> {
    this.assertNotSelf(viewerId, targetId, 'block');
    await this.assertExists(targetId);

    try {
      await this.blockModel.create({
        userId: new Types.ObjectId(viewerId),
        blockedUserId: new Types.ObjectId(targetId),
      });
    } catch (err) {
      // Blocking twice is a no-op, not an error.
      if (!isDuplicateKeyError(err)) throw err;
    }

    await this.friendshipModel.deleteOne({ pairKey: pairKeyFor(viewerId, targetId) }).exec();
  }

  async unblockUser(viewerId: string, targetId: string): Promise<void> {
    await this.blockModel
      .deleteOne({
        userId: new Types.ObjectId(viewerId),
        blockedUserId: new Types.ObjectId(targetId),
      })
      .exec();
  }

  async listBlocked(viewerId: string): Promise<PublicProfile[]> {
    const rows = await this.blockModel
      .find({ userId: new Types.ObjectId(viewerId) })
      .exec();

    const users = await this.userService.findManyByIds(
      rows.map((row) => row.blockedUserId.toString()),
    );
    return users.map((user) => this.userService.toPublicProfile(user));
  }

  /**
   * File a report.
   *
   * Deliberately does **not** require a friendship: someone who needs to report
   * a person is often someone who has just blocked them, and requiring the
   * relationship to still exist would make the button fail exactly when it
   * matters. It does require the subject to exist, so reports cannot be used to
   * probe for valid ids.
   */
  async reportUser(
    viewerId: string,
    subjectUserId: string,
    reason: ReportReason,
    note: string,
    messageId?: string,
  ): Promise<{ id: string }> {
    this.assertNotSelf(viewerId, subjectUserId, 'report');
    await this.assertExists(subjectUserId);

    // Snapshot the message so deleting it cannot destroy the evidence.
    let messageText: string | null = null;
    let resolvedMessageId: Types.ObjectId | null = null;
    if (messageId && Types.ObjectId.isValid(messageId)) {
      const message = await this.messageModel.findById(messageId).exec();
      // Only a message the reporter could actually see.
      if (message && message.pairKey === pairKeyFor(viewerId, subjectUserId)) {
        messageText = message.text;
        resolvedMessageId = message._id;
      }
    }

    const report = await this.reportModel.create({
      reporterId: new Types.ObjectId(viewerId),
      subjectUserId: new Types.ObjectId(subjectUserId),
      messageId: resolvedMessageId,
      messageText,
      reason,
      note: note.slice(0, 1000),
    });

    return { id: report._id.toString() };
  }

  // -------------------------------------------------------------------------
  // Guards
  // -------------------------------------------------------------------------

  private assertNotSelf(viewerId: string, targetId: string, verb: string): void {
    if (viewerId === targetId) {
      throw new BadRequestException(`You cannot ${verb} yourself`);
    }
  }

  private async assertExists(userId: string): Promise<void> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundException('User not found');
    }
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
  }

  /** Every precondition for one learner to write to another, in order of cost. */
  private async assertMayMessage(viewerId: string, targetId: string): Promise<void> {
    const viewer = await this.userService.findById(viewerId);
    if (!viewer) {
      throw new NotFoundException('User not found');
    }

    // Rule 3: unknown age fails closed. Accounts predating the gate land here.
    if (!meetsMinimumAge(viewer.profile.dateOfBirth, new Date(), MIN_AGE_FOR_MESSAGING)) {
      throw new ForbiddenException(
        'Add your date of birth in Settings before messaging other learners.',
      );
    }

    await this.assertNotBlocked(viewerId, targetId);

    // Rule 1: the friendship is the authorisation. Checked last because it is
    // the read most likely to be satisfied, and cheapest to reason about after
    // the others have ruled out the hostile cases.
    const friendship = await this.friendshipModel
      .findOne({ pairKey: pairKeyFor(viewerId, targetId), status: 'accepted' })
      .exec();

    if (!friendship) {
      throw new ForbiddenException('You can only message people you are friends with');
    }
  }

  /** Rule 2: a block in *either* direction disqualifies. */
  private async assertNotBlocked(viewerId: string, targetId: string): Promise<void> {
    const viewer = new Types.ObjectId(viewerId);
    const target = new Types.ObjectId(targetId);

    const block = await this.blockModel
      .findOne({
        $or: [
          { userId: viewer, blockedUserId: target },
          { userId: target, blockedUserId: viewer },
        ],
      })
      .exec();

    if (block) {
      // The same message whichever direction the block runs. Saying "they have
      // blocked you" tells someone they were blocked, which is information a
      // blocker did not consent to share.
      throw new ForbiddenException('This is not available');
    }
  }

  /** Every id involved in a block with the viewer, either way round. */
  private async blockedEitherWay(viewerId: string): Promise<Set<string>> {
    const id = new Types.ObjectId(viewerId);
    const rows = await this.blockModel
      .find({ $or: [{ userId: id }, { blockedUserId: id }] })
      .exec();

    const ids = new Set<string>();
    for (const row of rows) {
      ids.add(row.userId.toString());
      ids.add(row.blockedUserId.toString());
    }
    ids.delete(viewerId);
    return ids;
  }

  /**
   * Account-deletion cascade (OPEN-ITEMS #5/#32).
   *
   * Removes all social data that belongs to the user: friendships where they are
   * either requester or addressee, all their blocks (they blocked / were blocked),
   * and all their direct messages (sent or received).
   *
   * Reports are intentionally **not** deleted. A report that a user filed against
   * someone else is evidence for moderation — erasing it because the reporter
   * closes their account would let bad actors wipe the record by deleting and
   * re-registering. A report about the user is similar: the subject cannot
   * suppress a complaint just by leaving.
   *
   * Called by AccountDeletionService as part of the DELETE /me cascade.
   */
  async deleteAllForUser(userId: string): Promise<void> {
    const id = new Types.ObjectId(userId);
    await Promise.all([
      // Friendships in either direction
      this.friendshipModel
        .deleteMany({ $or: [{ requesterId: id }, { addresseeId: id }] })
        .exec(),
      // Blocks where this user is either the blocker or the blocked party
      this.blockModel
        .deleteMany({ $or: [{ userId: id }, { blockedUserId: id }] })
        .exec(),
      // Direct messages sent or received
      this.messageModel
        .deleteMany({ $or: [{ senderId: id }, { recipientId: id }] })
        .exec(),
    ]);
  }
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}
