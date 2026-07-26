import { ageInYears, meetsMinimumAge, MIN_AGE_TO_REGISTER } from './age';

const NOW = new Date('2026-07-26T12:00:00Z');

describe('ageInYears', () => {
  it('counts whole years', () => {
    expect(ageInYears(new Date('2000-07-26T00:00:00Z'), NOW)).toBe(26);
    expect(ageInYears(new Date('1990-01-01T00:00:00Z'), NOW)).toBe(36);
  });

  /**
   * The boundary the gate is actually policing. Dividing elapsed milliseconds by
   * 365.25 gets these wrong by a day either side, which would let a
   * twelve-year-old register the day before their birthday.
   */
  it('is exact on the birthday and the day before it', () => {
    // Turns 13 today.
    expect(ageInYears(new Date('2013-07-26T00:00:00Z'), NOW)).toBe(13);
    // Turns 13 tomorrow — still 12 today.
    expect(ageInYears(new Date('2013-07-27T00:00:00Z'), NOW)).toBe(12);
    // Had their birthday yesterday.
    expect(ageInYears(new Date('2013-07-25T00:00:00Z'), NOW)).toBe(13);
  });

  it('handles a leap-day birth date', () => {
    // Born 29 Feb 2008; on 26 July 2026 they are 18 either way you count it.
    expect(ageInYears(new Date('2008-02-29T00:00:00Z'), NOW)).toBe(18);
  });

  it('returns null for a missing or unparseable date', () => {
    expect(ageInYears(null, NOW)).toBeNull();
    expect(ageInYears(undefined, NOW)).toBeNull();
    expect(ageInYears(new Date('not a date'), NOW)).toBeNull();
  });

  it('returns null for a birth date in the future rather than a negative age', () => {
    expect(ageInYears(new Date('2030-01-01T00:00:00Z'), NOW)).toBeNull();
  });
});

describe('meetsMinimumAge', () => {
  it('admits someone exactly at the minimum', () => {
    expect(meetsMinimumAge(new Date('2013-07-26T00:00:00Z'), NOW)).toBe(true);
  });

  it('refuses someone a day short of it', () => {
    expect(meetsMinimumAge(new Date('2013-07-27T00:00:00Z'), NOW)).toBe(false);
  });

  /**
   * The failure mode this function exists to prevent: an unknown age falling
   * through a `>=` comparison and passing. Every unusable input must be a
   * refusal, never a default-allow.
   */
  it('refuses an unknown age rather than letting it through', () => {
    expect(meetsMinimumAge(null, NOW)).toBe(false);
    expect(meetsMinimumAge(undefined, NOW)).toBe(false);
    expect(meetsMinimumAge(new Date('not a date'), NOW)).toBe(false);
    expect(meetsMinimumAge(new Date('2030-01-01T00:00:00Z'), NOW)).toBe(false);
  });

  it('takes a custom minimum', () => {
    const eighteenToday = new Date('2008-07-26T00:00:00Z');
    expect(meetsMinimumAge(eighteenToday, NOW, 18)).toBe(true);
    expect(meetsMinimumAge(eighteenToday, NOW, 19)).toBe(false);
  });

  it('defaults to the registration minimum', () => {
    expect(MIN_AGE_TO_REGISTER).toBe(13);
    expect(meetsMinimumAge(new Date('2012-01-01T00:00:00Z'), NOW)).toBe(true);
  });
});
