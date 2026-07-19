import { localDateString, nextStreak, previousDay } from './streak';

/**
 * The four cases the milestone calls for — same day, consecutive day, skipped
 * day, and a non-UTC learner — plus the boundary conditions that make the
 * timezone case actually mean something.
 *
 * These test the pure functions rather than going through UserService, because
 * the interesting logic is entirely calendar arithmetic; wrapping it in a Mongo
 * fake would test the fake.
 */
describe('streak', () => {
  const TZ = 'Asia/Kolkata';

  describe('the four milestone cases', () => {
    it('leaves the streak unchanged on a repeat action the same day', () => {
      const outcome = nextStreak(5, '2026-07-19', '2026-07-19');

      expect(outcome.streakDays).toBe(5);
      // The flag the caller uses to decide whether to reset today's XP counter.
      expect(outcome.isNewDay).toBe(false);
    });

    it('increments the streak on a consecutive day', () => {
      const outcome = nextStreak(5, '2026-07-18', '2026-07-19');

      expect(outcome.streakDays).toBe(6);
      expect(outcome.isNewDay).toBe(true);
    });

    it('resets the streak to 1 when a day was skipped', () => {
      // Last studied the 17th, now it's the 19th — the 18th was missed.
      const outcome = nextStreak(5, '2026-07-17', '2026-07-19');

      // 1, not 0: today's action counts, so a reset streak is still a streak.
      expect(outcome.streakDays).toBe(1);
      expect(outcome.isNewDay).toBe(true);
    });

    it('tracks the local day for a user in a non-UTC timezone', () => {
      // 2026-07-18T20:00Z is already the 19th in Kolkata (+05:30) but still the
      // 18th in UTC. A user studying at this instant, having last studied on
      // their local 18th, must see their streak advance — comparing UTC
      // timestamps would call it the same day and silently freeze the streak.
      const instant = new Date('2026-07-18T20:00:00Z');

      expect(localDateString(instant, TZ)).toBe('2026-07-19');
      expect(localDateString(instant, 'UTC')).toBe('2026-07-18');

      const outcome = nextStreak(3, '2026-07-18', localDateString(instant, TZ));
      expect(outcome.streakDays).toBe(4);
    });
  });

  describe('localDateString', () => {
    it('renders the day behind UTC for a western zone', () => {
      // 03:00Z is still the previous evening in Los Angeles (-07:00).
      const instant = new Date('2026-07-19T03:00:00Z');

      expect(localDateString(instant, 'America/Los_Angeles')).toBe('2026-07-18');
      expect(localDateString(instant, 'UTC')).toBe('2026-07-19');
    });

    it('zero-pads months and days to a sortable YYYY-MM-DD', () => {
      expect(localDateString(new Date('2026-01-05T12:00:00Z'), 'UTC')).toBe('2026-01-05');
    });

    it('falls back to UTC for an unknown zone rather than throwing', () => {
      // A tz stored before validation existed must not 500 every XP award.
      expect(localDateString(new Date('2026-07-19T12:00:00Z'), 'Mars/Olympus')).toBe('2026-07-19');
    });
  });

  describe('previousDay', () => {
    it('crosses month boundaries', () => {
      expect(previousDay('2026-08-01')).toBe('2026-07-31');
    });

    it('crosses year boundaries', () => {
      expect(previousDay('2026-01-01')).toBe('2025-12-31');
    });

    it('handles a leap day', () => {
      expect(previousDay('2028-03-01')).toBe('2028-02-29');
    });
  });

  describe('edge cases', () => {
    it('starts a streak at 1 for a user who has never studied', () => {
      const outcome = nextStreak(0, null, '2026-07-19');

      expect(outcome.streakDays).toBe(1);
      expect(outcome.isNewDay).toBe(true);
    });

    it('advances across a month boundary', () => {
      expect(nextStreak(9, '2026-07-31', '2026-08-01').streakDays).toBe(10);
    });

    it('survives a DST transition without dropping a day', () => {
      // New York springs forward on 2026-03-08 — a 23-hour local day. The
      // calendar dates either side are still consecutive, which is exactly why
      // previousDay does its arithmetic in UTC on an already-local date.
      const before = localDateString(new Date('2026-03-07T18:00:00Z'), 'America/New_York');
      const after = localDateString(new Date('2026-03-08T18:00:00Z'), 'America/New_York');

      expect(before).toBe('2026-03-07');
      expect(after).toBe('2026-03-08');
      expect(nextStreak(2, before, after).streakDays).toBe(3);
    });
  });
});
