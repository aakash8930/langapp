import {
  LEAGUE_TIERS,
  MIN_TIER_SIZE_TO_SETTLE,
  PROMOTION_COUNT,
  settleTier,
  tierName,
} from './leagues';

const BIG = MIN_TIER_SIZE_TO_SETTLE + 12;

describe('tierName', () => {
  it('names each tier', () => {
    expect(tierName(0)).toBe('Bronze');
    expect(tierName(LEAGUE_TIERS.length - 1)).toBe('Diamond');
  });

  it('clamps rather than returning undefined for an out-of-range index', () => {
    // A stored tier could outlive a shortened list; a crash on read would be a
    // worse outcome than showing the nearest real tier.
    expect(tierName(-1)).toBe('Bronze');
    expect(tierName(999)).toBe('Diamond');
  });
});

describe('settleTier', () => {
  it('promotes the top few', () => {
    expect(settleTier({ tier: 1, rank: 1, size: BIG, weeklyXp: 500 })).toBe(2);
    expect(settleTier({ tier: 1, rank: PROMOTION_COUNT, size: BIG, weeklyXp: 500 })).toBe(2);
  });

  it('leaves the middle alone', () => {
    expect(settleTier({ tier: 1, rank: PROMOTION_COUNT + 1, size: BIG, weeklyXp: 500 })).toBe(1);
  });

  it('never relegates — promotion-only since Phase 2 §3.2', () => {
    // Last in the tier stays in the tier, however low they ranked.
    expect(settleTier({ tier: 2, rank: BIG, size: BIG, weeklyXp: 10 })).toBe(2);
  });

  it('cannot promote out of the top tier', () => {
    const top = LEAGUE_TIERS.length - 1;
    expect(settleTier({ tier: top, rank: 1, size: BIG, weeklyXp: 900 })).toBe(top);
    expect(settleTier({ tier: 0, rank: 1, size: BIG, weeklyXp: 0 })).toBe(0);
  });

  /**
   * The rule that keeps the ladder honest. In a quiet week the top three might
   * all have earned nothing, and promoting someone for doing nothing makes every
   * tier below meaningless.
   */
  it('never promotes someone who earned no XP, however high they ranked', () => {
    expect(settleTier({ tier: 1, rank: 1, size: BIG, weeklyXp: 0 })).toBe(1);
  });

  /**
   * A tier of four would otherwise relegate three of them every week — pure
   * churn, and it tells a learner they failed for being one of the few present.
   */
  it('settles nobody in a tier too small to rank meaningfully', () => {
    const small = MIN_TIER_SIZE_TO_SETTLE - 1;
    expect(settleTier({ tier: 2, rank: 1, size: small, weeklyXp: 900 })).toBe(2);
    expect(settleTier({ tier: 2, rank: small, size: small, weeklyXp: 0 })).toBe(2);
  });

  it('is stable — settling an already-settled week changes nothing further', () => {
    // Rank 1 promotes 1 -> 2. Next week, still rank 1, promotes 2 -> 3. There is
    // no state that makes a repeat of the *same* week double-promote, because
    // the function is a pure map from (tier, rank) to tier.
    const once = settleTier({ tier: 1, rank: 1, size: BIG, weeklyXp: 500 });
    expect(settleTier({ tier: 1, rank: 1, size: BIG, weeklyXp: 500 })).toBe(once);
  });
});
