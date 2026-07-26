import { Types } from 'mongoose';
import { AnalyticsService } from './analytics.service';

const USER_ID = '607f1f77bcf86cd799439011';

/**
 * `countTodayByType` is the one piece of read logic in this service, and the
 * thing worth pinning is the *day boundary*: "today" is the user's local
 * calendar date, not a UTC one, and not a rolling 24 hours.
 */
function makeService(rows: { type: string; ts: Date }[]) {
  // The filter param is declared so `find.mock.calls[0][0]` is typed — the
  // window test reads the query off the call.
  const find = jest.fn(
    (_filter: { userId: Types.ObjectId; type: { $in: string[] }; ts: { $gte: Date } }) => ({
      select: () => ({ lean: () => ({ exec: () => Promise.resolve(rows) }) }),
    }),
  );
  const eventModel = { find, create: jest.fn(), countDocuments: jest.fn() };

  return { service: new AnalyticsService(eventModel as never), find };
}

describe('AnalyticsService.countTodayByType (T1.8)', () => {
  const TYPES = ['review.graded', 'lesson.completed'];

  it('counts each type separately and reports zero for a type with no events', async () => {
    const now = new Date('2026-07-26T12:00:00Z');
    const { service } = makeService([
      { type: 'review.graded', ts: new Date('2026-07-26T09:00:00Z') },
      { type: 'review.graded', ts: new Date('2026-07-26T10:00:00Z') },
    ]);

    const counts = await service.countTodayByType(USER_ID, TYPES, 'UTC', now);

    expect(counts).toEqual({ 'review.graded': 2, 'lesson.completed': 0 });
  });

  it('always returns a key per requested type, so a caller never reads undefined', async () => {
    const { service } = makeService([]);

    const counts = await service.countTodayByType(
      USER_ID,
      TYPES,
      'UTC',
      new Date('2026-07-26T12:00:00Z'),
    );

    expect(Object.keys(counts).sort()).toEqual(['lesson.completed', 'review.graded']);
  });

  /**
   * The reason this filters in memory rather than with a Mongo range query. Both
   * events are inside the 48-hour window, but only one falls on the learner's
   * local today — and which one depends entirely on the zone.
   */
  it("counts on the user's local day, not a UTC one", async () => {
    // 2026-07-26T02:00Z is still the 25th in New York (22:00 on the 25th) but
    // already the 26th in Tokyo (11:00).
    const rows = [
      { type: 'review.graded', ts: new Date('2026-07-26T02:00:00Z') },
      { type: 'review.graded', ts: new Date('2026-07-26T16:00:00Z') },
    ];

    // At 18:00Z: NY local date is the 26th, so only the 16:00Z event counts.
    const ny = await makeService(rows).service.countTodayByType(
      USER_ID,
      TYPES,
      'America/New_York',
      new Date('2026-07-26T18:00:00Z'),
    );
    expect(ny['review.graded']).toBe(1);

    // Same instants, Tokyo. At 02:00Z Tokyo is already the 26th; 16:00Z is the
    // 27th there (01:00). Asking at 04:00Z (13:00 on the 26th) counts the first.
    const tokyo = await makeService(rows).service.countTodayByType(
      USER_ID,
      TYPES,
      'Asia/Tokyo',
      new Date('2026-07-26T04:00:00Z'),
    );
    expect(tokyo['review.graded']).toBe(1);
  });

  it('excludes yesterday even when it is within the fetched window', async () => {
    const now = new Date('2026-07-26T12:00:00Z');
    const { service } = makeService([
      { type: 'review.graded', ts: new Date('2026-07-25T12:00:00Z') },
      { type: 'lesson.completed', ts: new Date('2026-07-26T11:00:00Z') },
    ]);

    const counts = await service.countTodayByType(USER_ID, TYPES, 'UTC', now);

    expect(counts).toEqual({ 'review.graded': 0, 'lesson.completed': 1 });
  });

  it('queries a 48-hour window scoped to the user and the requested types', async () => {
    const now = new Date('2026-07-26T12:00:00Z');
    const { service, find } = makeService([]);

    await service.countTodayByType(USER_ID, TYPES, 'UTC', now);

    const filter = find.mock.calls[0][0];
    expect(filter.userId.toString()).toBe(USER_ID);
    expect(filter.type.$in).toEqual(TYPES);
    expect(now.getTime() - filter.ts.$gte.getTime()).toBe(48 * 60 * 60 * 1000);
  });

  it('does not query at all when asked for no types', async () => {
    const { service, find } = makeService([]);

    const counts = await service.countTodayByType(
      USER_ID,
      [],
      'UTC',
      new Date('2026-07-26T12:00:00Z'),
    );

    expect(counts).toEqual({});
    expect(find).not.toHaveBeenCalled();
  });
});
