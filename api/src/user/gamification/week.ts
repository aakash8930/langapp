/**
 * Which week it is, for the leaderboard.
 *
 * ## Why this is UTC when the streak is not
 *
 * Everything else time-related in this app is measured in the *learner's* local
 * zone: `lastStudyDate`, `todayXp`, the daily goal. That is right for those,
 * because "did I study today" is a question about the learner's own day.
 *
 * A leaderboard is the opposite. It compares people to each other, so it needs
 * **one shared clock** — if each learner's week began at their own local
 * midnight, someone in Auckland and someone in Los Angeles would be ranked
 * against each other over windows offset by nearly a day, and the person whose
 * week ended later could always see the target before deciding whether to
 * overtake it. The ranking would not mean anything.
 *
 * So: ISO week, UTC. It is unfair to nobody in particular, which is the most a
 * global boundary can manage, and it is the same choice every competitive
 * leaderboard makes.
 */

/**
 * ISO-8601 week identifier — `'2026-W31'`.
 *
 * ISO rather than "days since epoch / 7" because ISO weeks start on Monday and
 * handle the year boundary properly: 1 January can belong to week 52 of the
 * previous year, and a naive `getFullYear()` would file it under the wrong one
 * and silently reset everyone's standing mid-week.
 */
export function isoWeek(instant: Date): string {
  // Work on a copy at UTC midnight so time-of-day cannot affect the arithmetic.
  const date = new Date(
    Date.UTC(instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate()),
  );

  // ISO weekday: Monday 1 … Sunday 7 (getUTCDay gives Sunday 0).
  const isoDay = date.getUTCDay() === 0 ? 7 : date.getUTCDay();

  // Shift to the Thursday of this week. ISO defines a week's year as the year
  // containing its Thursday, which is precisely what makes the turn-of-year
  // cases come out right.
  date.setUTCDate(date.getUTCDate() + 4 - isoDay);

  const year = date.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(year, 0, 4));
  const firstIsoDay = firstThursday.getUTCDay() === 0 ? 7 : firstThursday.getUTCDay();
  firstThursday.setUTCDate(firstThursday.getUTCDate() + 4 - firstIsoDay);

  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86_400_000));

  return `${year}-W${String(week).padStart(2, '0')}`;
}

/**
 * The instant a week's competition closes — the Monday 00:00 UTC that ends it.
 *
 * Returned so a client can show "3 days left" without re-deriving ISO week
 * arithmetic, and so both sides agree on the deadline to the second.
 */
export function weekEndsAt(instant: Date): Date {
  const date = new Date(
    Date.UTC(instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate()),
  );
  const isoDay = date.getUTCDay() === 0 ? 7 : date.getUTCDay();

  // Days remaining until next Monday: 7 minus how far into the week we are.
  date.setUTCDate(date.getUTCDate() + (8 - isoDay));

  return date;
}
