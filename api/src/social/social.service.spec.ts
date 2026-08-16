import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { UserService } from '../user/user.service';
import { UserDocument } from '../user/schemas/user.schema';
import { pairKeyFor } from './schemas/friendship.schema';
import { SocialService } from './social.service';

const ME = '607f1f77bcf86cd799439011';
const THEM = '607f1f77bcf86cd799439022';

/** Comfortably over the messaging minimum. */
const ADULT_DOB = new Date('1995-06-15');

function userDoc(id: string, dateOfBirth: Date | null = ADULT_DOB): UserDocument {
  return {
    _id: new Types.ObjectId(id),
    profile: { displayName: 'Learner', dateOfBirth },
    gamification: { xp: 0, streakDays: 0 },
  } as unknown as UserDocument;
}

/**
 * The safety rules are the reason this module exists in the shape it does, so
 * they are what the tests are about — not the CRUD.
 */
function build(
  opts: {
    /** The accepted/pending friendship row `findOne` should return, if any. */
    friendship?: { status: 'pending' | 'accepted'; addresseeId?: string } | null;
    /** A block row, meaning someone blocked someone. */
    block?: { userId: string; blockedUserId: string } | null;
    viewerDob?: Date | null;
    targetExists?: boolean;
  } = {},
) {
  // Honours the `status` in the filter, because the service relies on Mongo to
  // do that — a mock that returns the row regardless would pass a pending
  // friendship off as an accepted one and hide the exact bug this guards.
  const friendshipFindOne = jest.fn((filter: { status?: string } = {}) => ({
    exec: () =>
      Promise.resolve(
        opts.friendship && (filter.status === undefined || filter.status === opts.friendship.status)
          ? {
              _id: new Types.ObjectId(),
              status: opts.friendship.status,
              addresseeId: new Types.ObjectId(opts.friendship.addresseeId ?? ME),
              requesterId: new Types.ObjectId(THEM),
              pairKey: pairKeyFor(ME, THEM),
            }
          : null,
      ),
  }));
  const friendshipCreate = jest.fn(() => Promise.resolve({}));
  const friendshipDelete = jest.fn(() => ({ exec: () => Promise.resolve({}) }));
  const friendshipModel = {
    findOne: friendshipFindOne,
    findById: jest.fn(() => ({ exec: () => Promise.resolve(null) })),
    find: jest.fn(() => ({ exec: () => Promise.resolve([]) })),
    create: friendshipCreate,
    updateOne: jest.fn(() => ({ exec: () => Promise.resolve({}) })),
    deleteOne: friendshipDelete,
  };

  const messageCreate = jest.fn(() =>
    Promise.resolve({
      _id: new Types.ObjectId(),
      text: 'こんにちは',
      get: () => new Date(),
    }),
  );
  const messageModel = {
    create: messageCreate,
    find: jest.fn(() => ({
      sort: () => ({ limit: () => ({ exec: () => Promise.resolve([]) }) }),
    })),
    findById: jest.fn(() => ({ exec: () => Promise.resolve(null) })),
    updateMany: jest.fn(() => ({ exec: () => Promise.resolve({}) })),
  };

  const blockFindOne = jest.fn(() => ({
    exec: () =>
      Promise.resolve(
        opts.block
          ? {
              userId: new Types.ObjectId(opts.block.userId),
              blockedUserId: new Types.ObjectId(opts.block.blockedUserId),
            }
          : null,
      ),
  }));
  const blockCreate = jest.fn(() => Promise.resolve({}));
  const blockModel = {
    findOne: blockFindOne,
    find: jest.fn(() => ({
      exec: () =>
        Promise.resolve(
          opts.block
            ? [
                {
                  userId: new Types.ObjectId(opts.block.userId),
                  blockedUserId: new Types.ObjectId(opts.block.blockedUserId),
                },
              ]
            : [],
        ),
    })),
    create: blockCreate,
    deleteOne: jest.fn(() => ({ exec: () => Promise.resolve({}) })),
  };

  const reportCreate = jest.fn(() => Promise.resolve({ _id: new Types.ObjectId() }));
  const reportModel = { create: reportCreate };

  const dob = opts.viewerDob === undefined ? ADULT_DOB : opts.viewerDob;
  const searchByDisplayName = jest.fn(
    (_query: string, _excludeIds: string[], _limit: number) => Promise.resolve([]),
  );
  const userService = {
    findById: jest.fn((id: string) =>
      Promise.resolve(
        id === ME
          ? userDoc(ME, dob)
          : opts.targetExists === false
            ? null
            : userDoc(THEM),
      ),
    ),
    findManyByIds: jest.fn(() => Promise.resolve([])),
    searchByDisplayName,
    toPublicProfile: (user: UserDocument) => ({
      id: user._id.toString(),
      displayName: 'Learner',
      level: 1,
      xp: 0,
      streakDays: 0,
    }),
  } as unknown as UserService;

  const notifications = { create: jest.fn().mockResolvedValue({}) };
  const service = new SocialService(
    friendshipModel as never,
    messageModel as never,
    blockModel as never,
    reportModel as never,
    userService,
    notifications as never,
  );

  return {
    service,
    messageCreate,
    friendshipCreate,
    friendshipDelete,
    blockCreate,
    reportCreate,
    searchByDisplayName,
  };
}

describe('SocialService — rule 1: messaging requires an accepted friendship', () => {
  it('refuses a message to a stranger', async () => {
    const { service, messageCreate } = build({ friendship: null });

    await expect(service.sendMessage(ME, THEM, 'hi')).rejects.toThrow(ForbiddenException);
    expect(messageCreate).not.toHaveBeenCalled();
  });

  it('refuses a message when the request is still pending', async () => {
    const { service, messageCreate } = build({ friendship: { status: 'pending' } });

    await expect(service.sendMessage(ME, THEM, 'hi')).rejects.toThrow(
      /only message people you are friends with/,
    );
    expect(messageCreate).not.toHaveBeenCalled();
  });

  it('allows a message between accepted friends', async () => {
    const { service, messageCreate } = build({ friendship: { status: 'accepted' } });

    const sent = await service.sendMessage(ME, THEM, 'こんにちは');

    expect(messageCreate).toHaveBeenCalled();
    expect(sent.text).toBe('こんにちは');
  });

  /**
   * Unfriending has to close the history, not merely stop new messages — so the
   * read re-checks rather than trusting that a friendship existed when the
   * messages were written.
   */
  it('refuses to read a conversation once the friendship is gone', async () => {
    const { service } = build({ friendship: null });

    await expect(service.listMessages(ME, THEM)).rejects.toThrow(ForbiddenException);
  });
});

describe('SocialService — rule 2: a block in either direction disqualifies', () => {
  it('refuses when the viewer blocked the target', async () => {
    const { service, messageCreate } = build({
      friendship: { status: 'accepted' },
      block: { userId: ME, blockedUserId: THEM },
    });

    await expect(service.sendMessage(ME, THEM, 'hi')).rejects.toThrow(ForbiddenException);
    expect(messageCreate).not.toHaveBeenCalled();
  });

  /**
   * The direction that actually protects someone: they blocked *me*, and I must
   * not be able to reach them.
   */
  it('refuses when the target blocked the viewer', async () => {
    const { service, messageCreate } = build({
      friendship: { status: 'accepted' },
      block: { userId: THEM, blockedUserId: ME },
    });

    await expect(service.sendMessage(ME, THEM, 'hi')).rejects.toThrow(ForbiddenException);
    expect(messageCreate).not.toHaveBeenCalled();
  });

  /**
   * The message must not reveal which way the block runs — telling someone "they
   * blocked you" discloses something the blocker never agreed to share.
   */
  it('gives the same opaque message whichever direction the block runs', async () => {
    const mine = build({ friendship: { status: 'accepted' }, block: { userId: ME, blockedUserId: THEM } });
    const theirs = build({ friendship: { status: 'accepted' }, block: { userId: THEM, blockedUserId: ME } });

    const a = await mine.service.sendMessage(ME, THEM, 'hi').catch((e: Error) => e.message);
    const b = await theirs.service.sendMessage(ME, THEM, 'hi').catch((e: Error) => e.message);

    expect(a).toBe(b);
    expect(a).not.toMatch(/blocked/i);
  });

  it('refuses a friend request across a block', async () => {
    const { service, friendshipCreate } = build({ block: { userId: THEM, blockedUserId: ME } });

    await expect(service.sendFriendRequest(ME, THEM)).rejects.toThrow(ForbiddenException);
    expect(friendshipCreate).not.toHaveBeenCalled();
  });

  it('drops the friendship when blocking, so a block is not merely a mute', async () => {
    const { service, friendshipDelete } = build();

    await service.blockUser(ME, THEM);

    expect(friendshipDelete).toHaveBeenCalledWith({ pairKey: pairKeyFor(ME, THEM) });
  });
});

describe('SocialService — rule 3: messaging needs a known age', () => {
  /**
   * The accounts that predate the age gate have no `dateOfBirth`. Unknown must
   * fail closed, or the gate is decorative for exactly the accounts it was added
   * because of.
   */
  it('refuses to message when the viewer has no date of birth', async () => {
    const { service, messageCreate } = build({
      friendship: { status: 'accepted' },
      viewerDob: null,
    });

    await expect(service.sendMessage(ME, THEM, 'hi')).rejects.toThrow(
      /date of birth/i,
    );
    expect(messageCreate).not.toHaveBeenCalled();
  });

  it('refuses to message when the viewer is under the minimum', async () => {
    const tooYoung = new Date();
    tooYoung.setFullYear(tooYoung.getFullYear() - 11);
    const { service, messageCreate } = build({
      friendship: { status: 'accepted' },
      viewerDob: tooYoung,
    });

    await expect(service.sendMessage(ME, THEM, 'hi')).rejects.toThrow(ForbiddenException);
    expect(messageCreate).not.toHaveBeenCalled();
  });
});

describe('SocialService — rule 4: not yourself', () => {
  it.each([
    ['message', (s: SocialService) => s.sendMessage(ME, ME, 'hi')],
    ['befriend', (s: SocialService) => s.sendFriendRequest(ME, ME)],
    ['block', (s: SocialService) => s.blockUser(ME, ME)],
    ['report', (s: SocialService) => s.reportUser(ME, ME, 'spam', '')],
  ])('refuses to %s yourself', async (_verb, act) => {
    const { service } = build({ friendship: { status: 'accepted' } });

    await expect(act(service)).rejects.toThrow(BadRequestException);
  });
});

describe('SocialService.searchUsers', () => {
  it('returns nothing for a query too short to be a search', async () => {
    const { service } = build();

    expect(await service.searchUsers(ME, 'a')).toEqual([]);
    expect(await service.searchUsers(ME, ' ')).toEqual([]);
  });

  it('excludes the viewer from their own results', async () => {
    const { service, searchByDisplayName } = build();

    await service.searchUsers(ME, 'lea');

    // A search that returns yourself is a bug people notice immediately.
    const [query, excluded] = searchByDisplayName.mock.calls[0];
    expect(query).toBe('lea');
    expect(excluded).toContain(ME);
  });

  it('hides anyone in a block relationship with the viewer, either direction', async () => {
    const { service, searchByDisplayName } = build({
      block: { userId: THEM, blockedUserId: ME },
    });

    await service.searchUsers(ME, 'lea');

    const [, excluded] = searchByDisplayName.mock.calls[0];
    expect(excluded).toContain(THEM);
  });
});

describe('SocialService.reportUser', () => {
  /**
   * Reporting deliberately does not require a friendship: the person who most
   * needs the button has usually just blocked the person they are reporting.
   */
  it('files a report with no friendship and no block relationship', async () => {
    const { service, reportCreate } = build({ friendship: null });

    const result = await service.reportUser(ME, THEM, 'harassment', 'said something awful');

    expect(reportCreate).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'harassment', note: 'said something awful' }),
    );
    expect(result.id).toEqual(expect.any(String));
  });

  it('refuses to report someone who does not exist, so it cannot probe for ids', async () => {
    const { service, reportCreate } = build({ targetExists: false });

    await expect(service.reportUser(ME, THEM, 'spam', '')).rejects.toThrow(NotFoundException);
    expect(reportCreate).not.toHaveBeenCalled();
  });
});
