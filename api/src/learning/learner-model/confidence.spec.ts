import {
  computeConfidence,
  computeItemMastery,
  EMPTY_STATS,
  EXPOSURES_FOR_FULL_EVIDENCE,
  pushOutcome,
  RECENT_OUTCOMES,
  recencyScore,
  RunningStats,
  speedScore,
  updateStats,
  variance,
} from './confidence';

describe('updateStats (Welford, §5.2)', () => {
  /**
   * The reason for Welford rather than storing samples is constant space, but the
   * reason to *trust* it is exactness — so this compares against the textbook
   * two-pass computation rather than against hand-written expectations.
   */
  function twoPass(samples: number[]): { mean: number; variance: number } {
    const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    const varianceValue =
      samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) / samples.length;
    return { mean, variance: varianceValue };
  }

  it('matches a two-pass mean and variance', () => {
    const samples = [1200, 800, 3400, 950, 1100, 2600, 700];
    const stats = samples.reduce(updateStats, EMPTY_STATS);
    const expected = twoPass(samples);

    expect(stats.count).toBe(samples.length);
    expect(stats.mean).toBeCloseTo(expected.mean, 6);
    expect(variance(stats)).toBeCloseTo(expected.variance, 6);
  });

  /**
   * The failure mode this algorithm exists to avoid: a naive sum-of-squares loses
   * precision when the values are large and close together. If someone
   * "simplifies" this later, this is the test that should stop them.
   */
  it('stays exact on large, tightly clustered samples', () => {
    const samples = Array.from({ length: 500 }, (_, i) => 1_000_000 + (i % 7));
    const stats = samples.reduce(updateStats, EMPTY_STATS);
    const expected = twoPass(samples);

    expect(stats.mean).toBeCloseTo(expected.mean, 6);
    expect(variance(stats)).toBeCloseTo(expected.variance, 6);
  });

  it('reports zero variance before there is anything to vary', () => {
    expect(variance(EMPTY_STATS)).toBe(0);
    expect(variance(updateStats(EMPTY_STATS, 1500))).toBe(0);
  });
});

describe('pushOutcome (recency ring, §5.2)', () => {
  it('keeps the most recent N and drops the oldest', () => {
    let outcomes: boolean[] = [];
    for (let i = 0; i < RECENT_OUTCOMES + 5; i++) {
      outcomes = pushOutcome(outcomes, i % 2 === 0);
    }

    expect(outcomes).toHaveLength(RECENT_OUTCOMES);
    // The 15th push (i=14) was correct, and it must be last.
    expect(outcomes[outcomes.length - 1]).toBe(true);
  });

  it('does not mutate the array it is given', () => {
    const original = [true, false];
    pushOutcome(original, true);
    expect(original).toEqual([true, false]);
  });
});

describe('recencyScore', () => {
  it('scores no evidence as zero rather than as neutral', () => {
    expect(recencyScore([])).toBe(0);
  });

  it('weights recent answers above older ones', () => {
    // Same ratio, opposite order: improving must score higher than declining.
    const improving = recencyScore([false, false, true, true]);
    const declining = recencyScore([true, true, false, false]);

    expect(improving).toBeGreaterThan(declining);
    expect(improving + declining).toBeCloseTo(1, 6);
  });

  it('is 1 for all correct and 0 for all wrong', () => {
    expect(recencyScore([true, true, true])).toBe(1);
    expect(recencyScore([false, false, false])).toBe(0);
  });
});

describe('speedScore', () => {
  const stats = (mean: number): RunningStats => ({ count: 4, mean, m2: 0 });

  /**
   * Neutral, not zero, when there is nothing to compare — a missing signal must
   * not look like a bad one. `LearnerProfile` does not exist yet, so this is the
   * common case today.
   */
  it('is neutral without a baseline or without samples', () => {
    expect(speedScore(stats(1200), null)).toBe(0.5);
    expect(speedScore(EMPTY_STATS, 1200)).toBe(0.5);
    expect(speedScore(stats(1200), 0)).toBe(0.5);
  });

  /**
   * Answering at your own average must score the same as *no* information (0.5).
   * The first version of this scored a perfect 1.0 at the baseline, which handed
   * every average answer a full speed bonus.
   */
  it('treats the learner’s own average as no signal either way', () => {
    expect(speedScore(stats(1000), 1000)).toBe(0.5);
    expect(speedScore(stats(1000), 1000)).toBe(speedScore(EMPTY_STATS, 1000));
  });

  it('rewards faster than the baseline and penalises slower', () => {
    expect(speedScore(stats(500), 1000)).toBe(1);
    expect(speedScore(stats(1500), 1000)).toBe(0);
    expect(speedScore(stats(750), 1000)).toBeGreaterThan(0.5);
    expect(speedScore(stats(1250), 1000)).toBeLessThan(0.5);
  });

  it('clamps rather than going out of range on extremes', () => {
    expect(speedScore(stats(1), 100_000)).toBe(1);
    expect(speedScore(stats(100_000), 1)).toBe(0);
  });
});

describe('computeConfidence (§6.1)', () => {
  const base = { lastNOutcomes: [] as boolean[], responseTimeMs: EMPTY_STATS, baselineMs: null };

  it('is 0 for an item never seen', () => {
    expect(computeConfidence({ ...base, exposures: 0 })).toBe(0);
  });

  /**
   * The property the design turns on: perfect answers on thin evidence must not
   * reach certainty, or an item is retired after two lucky answers.
   */
  it('scales down while evidence is thin, however good the outcomes', () => {
    const thin = computeConfidence({
      ...base,
      exposures: 2,
      lastNOutcomes: [true, true],
    });
    const full = computeConfidence({
      ...base,
      exposures: EXPOSURES_FOR_FULL_EVIDENCE,
      lastNOutcomes: [true, true, true, true, true],
    });

    expect(thin).toBeLessThan(full);
    expect(thin).toBeLessThan(0.5);
  });

  it('never leaves 0..1, on any input', () => {
    const inputs = [
      { exposures: 1, lastNOutcomes: [true], responseTimeMs: EMPTY_STATS, baselineMs: null },
      {
        exposures: 500,
        lastNOutcomes: Array(RECENT_OUTCOMES).fill(true) as boolean[],
        responseTimeMs: { count: 500, mean: 1, m2: 0 },
        baselineMs: 100_000,
      },
      {
        exposures: 500,
        lastNOutcomes: Array(RECENT_OUTCOMES).fill(false) as boolean[],
        responseTimeMs: { count: 500, mean: 100_000, m2: 0 },
        baselineMs: 1,
      },
    ];

    for (const input of inputs) {
      const confidence = computeConfidence(input);
      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(1);
    }
  });

  it('drops when the same item starts being missed', () => {
    const before = computeConfidence({
      ...base,
      exposures: 8,
      lastNOutcomes: [true, true, true, true, true, true],
    });
    const after = computeConfidence({
      ...base,
      exposures: 10,
      lastNOutcomes: [true, true, true, true, false, false],
    });

    expect(after).toBeLessThan(before);
  });

  /**
   * §5.2 asks for exactly this: a derived field that can drift from its inputs is
   * a bug waiting, so the stored value must be reproducible from the evidence.
   * Recomputing a spread of evidence twice and comparing is the cheap version of
   * that guarantee, and it is only possible because the function is pure.
   */
  it('is deterministic — same evidence, same number, every time', () => {
    for (let exposures = 0; exposures <= 20; exposures++) {
      const outcomes = Array.from({ length: Math.min(exposures, RECENT_OUTCOMES) }, (_, i) =>
        i % 3 !== 0,
      );
      const responseTimeMs = Array.from({ length: exposures }, (_, i) => 800 + i * 37).reduce(
        updateStats,
        EMPTY_STATS,
      );
      const input = { exposures, lastNOutcomes: outcomes, responseTimeMs, baselineMs: 1200 };

      expect(computeConfidence(input)).toBe(computeConfidence(input));
    }
  });
});

describe('computeItemMastery', () => {
  it('calls an unseen item new, whatever the confidence says', () => {
    expect(computeItemMastery(0.9, 0)).toBe('new');
  });

  it('bands confidence into learning, familiar and mastered', () => {
    expect(computeItemMastery(0.2, 8)).toBe('learning');
    expect(computeItemMastery(0.6, 8)).toBe('familiar');
    expect(computeItemMastery(0.9, 8)).toBe('mastered');
  });

  /**
   * High confidence on thin evidence stays `familiar`. Otherwise a learner who
   * got lucky twice never sees the item again — which is the opposite of what a
   * mastery signal is for.
   */
  it('withholds mastered until the evidence is complete', () => {
    expect(computeItemMastery(0.95, EXPOSURES_FOR_FULL_EVIDENCE - 1)).toBe('familiar');
    expect(computeItemMastery(0.95, EXPOSURES_FOR_FULL_EVIDENCE)).toBe('mastered');
  });
});
