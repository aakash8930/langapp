/**
 * Calendar arithmetic for the streak strip and the study calendar.
 *
 * ## Everything here is a 'YYYY-MM-DD' string, and that is the whole point
 *
 * The server stores `lastStudyDate` as a local calendar date in the learner's
 * *account* timezone — see `api/src/user/gamification/streak.ts`, which spells
 * out why: a day is a calendar concept, not a 24-hour window, and a learner in
 * Asia/Kolkata studying at 09:00 IST is on the 18th while UTC still says the
 * 17th. Comparing instants, or calling `toISOString()`, breaks their streak at
 * exactly the wrong moment.
 *
 * So this file never compares `Date` objects. It renders instants to day keys
 * in a named zone, and does the arithmetic on the keys.
 *
 * ## Which "today" — the browser's or the account's?
 *
 * The account's. This is the other half of the split documented in
 * `AppHeader.tsx`: the *greeting* reads the browser's clock, because it
 * describes where the learner is sitting right now, but anything the server
 * counts — the streak, the daily goal, which square on the calendar is
 * today — has to use `settings.tz` or it will disagree with the number the
 * server sent. A traveller whose account still says Asia/Kolkata gets a
 * greeting for where they are and a streak for where their account is, and
 * both are correct.
 */

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Renders an instant as 'YYYY-MM-DD' in the given IANA zone.
 *
 * Built from `formatToParts` rather than a locale format string, for the same
 * reason the server does: locale *output* varies between ICU versions, part
 * names do not.
 */
export function localDay(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: safeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);

  const part = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';

  return `${part('year')}-${part('month')}-${part('day')}`;
}

/**
 * A zone string that `Intl` will accept, falling back to UTC.
 *
 * `settings.tz` arrives from the API and could be anything a client once wrote
 * — an invalid zone throws a `RangeError` from the `DateTimeFormat`
 * constructor, and an uncaught throw in a render is a blank dashboard. The
 * server guards the same value the same way.
 */
function safeZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return timeZone;
  } catch {
    return 'UTC';
  }
}

/**
 * Shifts a day key by whole days.
 *
 * Done in UTC deliberately: the input is *already* a local calendar date, so
 * this is pure calendar arithmetic. Using UTC means a DST transition — where a
 * local day can be 23 or 25 hours long — cannot produce an off-by-one.
 */
export function addDays(day: string, delta: number): string {
  const [year, month, date] = day.split('-').map(Number);
  const shifted = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, date ?? 1) + delta * 86_400_000);

  return [
    shifted.getUTCFullYear(),
    pad(shifted.getUTCMonth() + 1),
    pad(shifted.getUTCDate()),
  ].join('-');
}

/** 0 = Monday … 6 = Sunday. Monday-first, as the design's week strip is. */
export function weekdayIndex(day: string): number {
  const [year, month, date] = day.split('-').map(Number);
  const utc = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, date ?? 1));
  return (utc.getUTCDay() + 6) % 7;
}

/** The day-of-month number, for a calendar cell. */
export function dayOfMonth(day: string): number {
  return Number(day.slice(8, 10));
}

/**
 * The days the streak *proves* were studied.
 *
 * A streak of N ending on `lastStudyDate` means those N consecutive days each
 * had study on them — that is the server's own definition, in `nextStreak`.
 * Nothing else on the wire records study history, so this is the complete set
 * of days that can be honestly marked, and it is why the calendar shows the
 * current month only: an earlier month would render as a grid of blanks, which
 * is a claim ("you studied nothing in April") rather than an absence of data.
 *
 * Capped, because the set is materialised: a 4000-day streak is not a reason to
 * build 4000 strings when the calendar shows at most six weeks of them.
 */
export function studiedDays(lastStudyDate: string | null, streakDays: number, cap = 400): Set<string> {
  const days = new Set<string>();
  if (!lastStudyDate || streakDays <= 0) return days;

  for (let back = 0; back < Math.min(streakDays, cap); back += 1) {
    days.add(addDays(lastStudyDate, -back));
  }
  return days;
}

/** The seven day keys of the Monday-first week containing `day`. */
export function weekOf(day: string): string[] {
  const monday = addDays(day, -weekdayIndex(day));
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

export type CalendarCell = {
  key: string;
  /** False for the leading/trailing days borrowed from the adjacent months. */
  inMonth: boolean;
};

/**
 * A Monday-first grid covering the whole month containing `day`, padded at both
 * ends with the adjacent months' days so every row has seven cells.
 *
 * Whole weeks rather than a ragged first row: a calendar whose first row starts
 * mid-week with empty boxes reads as missing data, which is the one thing this
 * grid must not imply.
 */
export function monthGrid(day: string): CalendarCell[] {
  const first = `${day.slice(0, 8)}01`;
  const start = addDays(first, -weekdayIndex(first));

  const month = day.slice(0, 7);
  const cells: CalendarCell[] = [];

  // Six weeks is the most any month can span (a 31-day month starting on a
  // Sunday). Trailing weeks that fall entirely outside the month are dropped
  // below rather than rendered as a blank row.
  for (let index = 0; index < 42; index += 1) {
    const key = addDays(start, index);
    cells.push({ key, inMonth: key.slice(0, 7) === month });
  }

  while (cells.length > 35 && cells.slice(35).every((cell) => !cell.inMonth)) {
    cells.length = 35;
  }

  return cells;
}

/** "August 2026", in the learner's locale. */
export function monthLabel(day: string): string {
  const [year, month] = day.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, 1)));
}
