import { MAX_HEARTS } from '../schemas/user.schema';
import { heartsNow, nextHeartAt, spendHeart } from './hearts';

const REGEN = 30;
const NOW = new Date('2026-07-26T12:00:00Z');

function minutesAgo(minutes: number): Date {
  return new Date(NOW.getTime() - minutes * 60 * 1000);
}

describe('heartsNow', () => {
  it('reads full for a fresh account that has never been docked', () => {
    expect(heartsNow({ hearts: MAX_HEARTS, heartsUpdatedAt: null }, REGEN, NOW)).toBe(MAX_HEARTS);
  });

  /**
   * A default-constructed document has `hearts: MAX_HEARTS` and a null stamp, but
   * a row written by an older build could have any count with no stamp. Treating
   * that as full is the forgiving direction — the alternative silently locks
   * someone out of the app over a missing timestamp.
   */
  it('treats a missing timestamp as full even when the stored count is low', () => {
    expect(heartsNow({ hearts: 0, heartsUpdatedAt: null }, REGEN, NOW)).toBe(MAX_HEARTS);
  });

  it('returns the stored count before an interval has elapsed', () => {
    expect(heartsNow({ hearts: 2, heartsUpdatedAt: minutesAgo(29) }, REGEN, NOW)).toBe(2);
  });

  it('regenerates one heart per interval', () => {
    expect(heartsNow({ hearts: 2, heartsUpdatedAt: minutesAgo(30) }, REGEN, NOW)).toBe(3);
    expect(heartsNow({ hearts: 2, heartsUpdatedAt: minutesAgo(61) }, REGEN, NOW)).toBe(4);
    expect(heartsNow({ hearts: 0, heartsUpdatedAt: minutesAgo(90) }, REGEN, NOW)).toBe(3);
  });

  it('caps at the maximum however long it has been', () => {
    expect(heartsNow({ hearts: 0, heartsUpdatedAt: minutesAgo(60 * 24 * 30) }, REGEN, NOW)).toBe(
      MAX_HEARTS,
    );
  });

  /**
   * A clock that jumps backwards — an NTP correction, or a database restored from
   * a backup taken earlier — must not take hearts away.
   */
  it('never removes hearts when the clock has gone backwards', () => {
    const future = new Date(NOW.getTime() + 60 * 60 * 1000);
    expect(heartsNow({ hearts: 2, heartsUpdatedAt: future }, REGEN, NOW)).toBe(2);
  });

  it('treats a non-positive regen interval as full rather than dividing by zero', () => {
    expect(heartsNow({ hearts: 1, heartsUpdatedAt: minutesAgo(10) }, 0, NOW)).toBe(MAX_HEARTS);
    expect(heartsNow({ hearts: 1, heartsUpdatedAt: minutesAgo(10) }, -5, NOW)).toBe(MAX_HEARTS);
  });
});

describe('nextHeartAt', () => {
  it('is null at full hearts', () => {
    expect(nextHeartAt({ hearts: MAX_HEARTS, heartsUpdatedAt: minutesAgo(5) }, REGEN, NOW)).toBe(
      null,
    );
  });

  it('is one interval after the stamp when nothing has regenerated yet', () => {
    const stamp = minutesAgo(10);
    expect(nextHeartAt({ hearts: 1, heartsUpdatedAt: stamp }, REGEN, NOW)).toEqual(
      new Date(stamp.getTime() + 30 * 60 * 1000),
    );
  });

  /**
   * The clock does not restart per heart. If it did, a learner who opened the app
   * every few minutes would regenerate faster than one who left it closed, because
   * each read would re-stamp the interval.
   */
  it('measures from the original stamp, not from the last regenerated heart', () => {
    const stamp = minutesAgo(70); // two hearts back, 10 minutes into the third
    const state = { hearts: 1, heartsUpdatedAt: stamp };

    expect(heartsNow(state, REGEN, NOW)).toBe(3);
    // Third interval from the stamp — 90 minutes — not 30 minutes from now.
    expect(nextHeartAt(state, REGEN, NOW)).toEqual(
      new Date(stamp.getTime() + 90 * 60 * 1000),
    );
  });

  it('agrees with heartsNow at the moment a heart lands', () => {
    const state = { hearts: 4, heartsUpdatedAt: minutesAgo(30) };
    // The fifth heart has just arrived, so there is no next one.
    expect(heartsNow(state, REGEN, NOW)).toBe(MAX_HEARTS);
    expect(nextHeartAt(state, REGEN, NOW)).toBe(null);
  });
});

describe('spendHeart', () => {
  it('takes one from the regenerated count, not the stored one', () => {
    // Stored 1, but 30 minutes have passed, so the learner really has 2.
    const next = spendHeart({ hearts: 1, heartsUpdatedAt: minutesAgo(30) }, REGEN, NOW);

    expect(next.hearts).toBe(1);
    expect(next.heartsUpdatedAt).toEqual(NOW);
  });

  it('cannot go below zero', () => {
    const next = spendHeart({ hearts: 0, heartsUpdatedAt: minutesAgo(1) }, REGEN, NOW);

    expect(next.hearts).toBe(0);
  });

  it('re-stamps even at zero, so the next heart is timed from this loss', () => {
    const next = spendHeart({ hearts: 0, heartsUpdatedAt: minutesAgo(120) }, REGEN, NOW);

    expect(next.heartsUpdatedAt).toEqual(NOW);
  });

  it('spending from full starts the regeneration clock', () => {
    const next = spendHeart({ hearts: MAX_HEARTS, heartsUpdatedAt: null }, REGEN, NOW);

    expect(next.hearts).toBe(MAX_HEARTS - 1);
    expect(next.heartsUpdatedAt).toEqual(NOW);
    expect(nextHeartAt(next, REGEN, NOW)).toEqual(new Date(NOW.getTime() + 30 * 60 * 1000));
  });
});
