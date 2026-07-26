/**
 * The minimum age to hold an account.
 *
 * Thirteen is the line COPPA draws in the US and the one most services adopt
 * globally; India's DPDP treats under-18s as children needing verifiable
 * parental consent, which this app has no mechanism for. So 13 is the *floor*,
 * not a claim of full compliance — see `MIN_AGE_FOR_MESSAGING` for the second
 * line, which is the one that actually matters for a messaging feature.
 */
export const MIN_AGE_TO_REGISTER = 13;

/**
 * The minimum age to exchange direct messages with another learner.
 *
 * Set to the same 13 rather than 18 deliberately: a language-exchange app whose
 * teenage users cannot talk to anyone is not the product, and Busuu and HelloTalk
 * both allow teen messaging. The protection here is structural rather than
 * age-segregating — **messages are only possible between accepted friends**, so
 * there is no path for a stranger to open a conversation with a minor, plus
 * per-user blocking and message reporting.
 *
 * Kept as its own constant because that reasoning could change. If minor↔adult
 * contact ever needs restricting, this is the seam to do it at, and the schema
 * already stores what the check would need.
 */
export const MIN_AGE_FOR_MESSAGING = 13;

/**
 * Whole years between `dateOfBirth` and `now`.
 *
 * Calendar arithmetic rather than dividing elapsed milliseconds by 365.25: the
 * naive version drifts across leap years and can report someone as 13 a day
 * before their birthday, which is exactly the boundary this is used to police.
 *
 * Returns null for an unusable date — a missing or unparseable value is "unknown
 * age", which callers must treat as *not* meeting an age requirement rather than
 * as passing it.
 */
export function ageInYears(dateOfBirth: Date | null | undefined, now: Date): number | null {
  if (!dateOfBirth || Number.isNaN(dateOfBirth.getTime())) {
    return null;
  }
  // A birth date in the future is not a young user, it is a broken one.
  if (dateOfBirth.getTime() > now.getTime()) {
    return null;
  }

  let years = now.getUTCFullYear() - dateOfBirth.getUTCFullYear();

  const monthDelta = now.getUTCMonth() - dateOfBirth.getUTCMonth();
  const dayDelta = now.getUTCDate() - dateOfBirth.getUTCDate();
  // Birthday hasn't come round yet this year.
  if (monthDelta < 0 || (monthDelta === 0 && dayDelta < 0)) {
    years -= 1;
  }

  return years;
}

/**
 * Old enough to register?
 *
 * Unknown age is **false**. That is the whole point of separating this from
 * `ageInYears`: a null must never fall through a `>=` comparison and quietly
 * pass, which is how age gates usually fail.
 */
export function meetsMinimumAge(
  dateOfBirth: Date | null | undefined,
  now: Date,
  minimum: number = MIN_AGE_TO_REGISTER,
): boolean {
  const age = ageInYears(dateOfBirth, now);
  return age !== null && age >= minimum;
}
