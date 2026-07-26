import { isoWeek, weekEndsAt } from './week';

describe('isoWeek', () => {
  it('is stable across a week and changes on Monday', () => {
    // 2026-07-26 is a Sunday; 2026-07-27 the Monday after.
    expect(isoWeek(new Date('2026-07-20T00:00:00Z'))).toBe('2026-W30'); // Monday
    expect(isoWeek(new Date('2026-07-26T23:59:59Z'))).toBe('2026-W30'); // Sunday, last second
    expect(isoWeek(new Date('2026-07-27T00:00:00Z'))).toBe('2026-W31'); // Monday, first second
  });

  it('ignores time of day', () => {
    expect(isoWeek(new Date('2026-07-22T00:00:00Z'))).toBe(
      isoWeek(new Date('2026-07-22T23:59:59Z')),
    );
  });

  /**
   * The reason this is ISO rather than "days since epoch / 7". Around new year a
   * naive implementation files days under the wrong year and silently resets
   * every standing mid-week.
   */
  it('handles the turn of the year the way ISO defines it', () => {
    // 2026-01-01 is a Thursday, so it belongs to week 1 of 2026.
    expect(isoWeek(new Date('2026-01-01T12:00:00Z'))).toBe('2026-W01');
    // 2025-12-29 is the Monday of that same ISO week — also 2026-W01.
    expect(isoWeek(new Date('2025-12-29T12:00:00Z'))).toBe('2026-W01');
    // 2025-12-28 is the Sunday before it, closing 2025's last week.
    expect(isoWeek(new Date('2025-12-28T12:00:00Z'))).toBe('2025-W52');
  });

  it('gives a 53rd week to years that have one', () => {
    // 2026 is a 53-week ISO year: 2026-12-31 is a Thursday.
    expect(isoWeek(new Date('2026-12-31T12:00:00Z'))).toBe('2026-W53');
    // And the days after it belong to 2027's first week.
    expect(isoWeek(new Date('2027-01-04T12:00:00Z'))).toBe('2027-W01');
  });

  it('zero-pads so the identifiers sort lexicographically', () => {
    expect(isoWeek(new Date('2026-01-08T12:00:00Z'))).toBe('2026-W02');
    // Lexical order must match chronological order, since the settle check is a
    // string comparison.
    expect('2026-W02' < '2026-W10').toBe(true);
  });
});

describe('weekEndsAt', () => {
  it('is the next Monday at midnight UTC', () => {
    // From a Wednesday.
    expect(weekEndsAt(new Date('2026-07-22T15:00:00Z'))).toEqual(
      new Date('2026-07-27T00:00:00Z'),
    );
    // From the Sunday — still the same Monday.
    expect(weekEndsAt(new Date('2026-07-26T23:00:00Z'))).toEqual(
      new Date('2026-07-27T00:00:00Z'),
    );
  });

  /**
   * On a Monday the week has just begun, so it ends a full seven days later —
   * not today. An off-by-one here would show "0 days left" all Monday.
   */
  it('is seven days out when asked on a Monday', () => {
    expect(weekEndsAt(new Date('2026-07-27T00:00:01Z'))).toEqual(
      new Date('2026-08-03T00:00:00Z'),
    );
  });

  it('always lands in the week after the one it was asked about', () => {
    const wednesday = new Date('2026-07-22T15:00:00Z');
    expect(isoWeek(wednesday)).toBe('2026-W30');
    // The instant the week closes already belongs to the next one.
    expect(isoWeek(weekEndsAt(wednesday))).toBe('2026-W31');
  });
});
