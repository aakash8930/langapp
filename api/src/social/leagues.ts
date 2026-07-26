/**
 * League tiers, lowest first. A learner's `gamification.leagueTier` indexes into
 * this.
 *
 * Six rather than Duolingo's ten. Tiers only mean anything if each holds enough
 * people to make a ranking interesting, and this app has 32 accounts — ten tiers
 * would average three learners each, where "1st place" is a participation
 * ribbon. Six is already generous at this size; the list is the thing to extend
 * when there are people to fill it.
 */
export const LEAGUE_TIERS = [
  'Bronze',
  'Silver',
  'Gold',
  'Sapphire',
  'Ruby',
  'Diamond',
] as const;

export type LeagueTier = (typeof LEAGUE_TIERS)[number];

/** How many at the top of a tier go up when the week closes. */
export const PROMOTION_COUNT = 3;

/** How many at the bottom go down. */
export const RELEGATION_COUNT = 3;

/**
 * A tier this small cannot be meaningfully split, so nobody is promoted or
 * relegated out of it until it has enough people that finishing last means
 * something.
 *
 * Without this, a tier of four would relegate three of them every week — the
 * mechanic would be pure churn and would tell a learner they had failed for
 * being one of the only people present.
 */
export const MIN_TIER_SIZE_TO_SETTLE = 8;

export function tierName(index: number): LeagueTier {
  const clamped = Math.min(Math.max(index, 0), LEAGUE_TIERS.length - 1);
  return LEAGUE_TIERS[clamped];
}

/**
 * Where a learner ends up after a week closes.
 *
 * Pure, so the rules are testable without a database — the same reasoning behind
 * `streak.ts` and `hearts.ts`. `rank` is 1-based.
 *
 * Three rules:
 *   - top `PROMOTION_COUNT` go up, unless already in the highest tier
 *   - bottom `RELEGATION_COUNT` go down, unless already in the lowest
 *   - **anyone who earned no XP at all is never promoted**, whatever their rank.
 *     In a quiet tier the top three might all have zero, and promoting someone
 *     for doing nothing makes the whole ladder meaningless.
 */
export function settleTier(input: {
  tier: number;
  rank: number;
  size: number;
  weeklyXp: number;
}): number {
  const { tier, rank, size, weeklyXp } = input;

  if (size < MIN_TIER_SIZE_TO_SETTLE) {
    return tier;
  }

  if (rank <= PROMOTION_COUNT && weeklyXp > 0) {
    return Math.min(tier + 1, LEAGUE_TIERS.length - 1);
  }

  if (rank > size - RELEGATION_COUNT) {
    return Math.max(tier - 1, 0);
  }

  return tier;
}
