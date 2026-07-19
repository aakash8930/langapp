/**
 * Streak arithmetic, kept pure and free of Mongo so it can be tested directly.
 *
 * The whole problem here is that "a day" is a local calendar concept, not a
 * 24-hour window. A learner in Asia/Kolkata studying at 09:00 IST is on
 * 2026-07-18 locally while UTC still says 2026-07-17. Comparing timestamps —
 * or calling toISOString() — breaks their streak at exactly the wrong moment.
 * So every comparison below happens on 'YYYY-MM-DD' strings rendered in the
 * user's own zone.
 */

/** Renders an instant as 'YYYY-MM-DD' in the given IANA zone. */
export function localDateString(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: safeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);

  const part = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';

  // Built from parts rather than a locale format string — locale output varies
  // between ICU versions, part names don't.
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/**
 * The calendar day before a 'YYYY-MM-DD' string.
 *
 * Done in UTC deliberately: the input is already a local calendar date, so this
 * is pure calendar arithmetic. Using UTC here means DST transitions — where a
 * local day can be 23 or 25 hours long — can't produce an off-by-one.
 */
export function previousDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const previous = new Date(Date.UTC(year, month - 1, day) - 86_400_000);

  return [
    previous.getUTCFullYear(),
    pad(previous.getUTCMonth() + 1),
    pad(previous.getUTCDate()),
  ].join('-');
}

export interface StreakOutcome {
  streakDays: number;
  /** True when this is the first XP-earning action of a new local day. */
  isNewDay: boolean;
}

/**
 * Streak rules:
 *  - already studied today  -> unchanged
 *  - studied yesterday      -> +1
 *  - first ever, or a gap   -> 1 (today counts, so it's never 0)
 */
export function nextStreak(
  currentStreak: number,
  lastStudyDate: string | null,
  today: string,
): StreakOutcome {
  if (lastStudyDate === today) {
    return { streakDays: currentStreak, isNewDay: false };
  }

  if (lastStudyDate !== null && lastStudyDate === previousDay(today)) {
    return { streakDays: currentStreak + 1, isNewDay: true };
  }

  return { streakDays: 1, isNewDay: true };
}

/**
 * A stored tz could be invalid if it was written before validation existed, or
 * if the IANA database drops a zone. Falling back to UTC keeps XP flowing; the
 * alternative is a 500 on every award.
 */
function safeZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return timeZone;
  } catch {
    return 'UTC';
  }
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}
