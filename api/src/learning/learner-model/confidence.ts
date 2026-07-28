/**
 * The learner model's arithmetic (§5.2, §6.1). Pure functions, no I/O, so the
 * numbers that decide what a learner is shown can be tested directly.
 *
 * ## Confidence is not stability
 *
 * FSRS already estimates *predicted retention* and owns every interval.
 * Confidence measures something different — **felt certainty**, from recent
 * outcomes and how long the learner took — and §6.1 is explicit that it is
 * deliberately not a function of stability. A fast correct answer and a slow
 * correct answer are different observations, and response time is the only
 * signal in the system that can tell them apart.
 *
 * **Nothing here may ever be written back into FSRS state.** The engine may
 * choose what to show; `stability`, `difficulty`, `state`, `reps` and `lapses`
 * change only in a real graded review. The precedent is `scheduleMissedWords`,
 * which moves `due` and nothing else.
 */

/** Ring-buffer length for recency. §5.2 fixes N at 10. */
export const RECENT_OUTCOMES = 10;

/**
 * Exposures at which the evidence is treated as complete.
 *
 * Below this, confidence is scaled down however good the outcomes look: two
 * correct answers out of two is weak evidence, and treating it as certainty
 * would retire an item the learner has barely met. Five is the smallest number
 * that spans a lesson plus a review or two, so an item reaches full weight
 * through ordinary use rather than needing to be drilled.
 */
export const EXPOSURES_FOR_FULL_EVIDENCE = 5;

/**
 * How the two observations are weighted against each other.
 *
 * Outcomes dominate because they are unambiguous — a wrong answer is wrong.
 * Speed is a real signal but a noisy one: a learner is interrupted, reads the
 * question twice, or answers on a phone on a bus. It adjusts confidence rather
 * than deciding it.
 */
export const OUTCOME_WEIGHT = 0.75;
export const SPEED_WEIGHT = 0.25;

/**
 * Mastery bands over confidence. Named because these decide what the word
 * "mastered" means to a learner, which §6.1 lists as a defect where they are
 * bare numbers.
 *
 * `mastered` additionally requires full evidence: high confidence from three
 * exposures is a small sample, and calling that mastered is how a learner ends
 * up never seeing an item again after getting lucky twice.
 */
export const CONFIDENCE_LEARNING_BELOW = 0.5;
export const CONFIDENCE_FAMILIAR_BELOW = 0.8;

export type ItemMasteryLevel = 'new' | 'learning' | 'familiar' | 'mastered';

/** Welford running statistics — mean and variance in constant space (§5.2). */
export interface RunningStats {
  count: number;
  mean: number;
  /** Sum of squared deviations. Variance is `m2 / count`. */
  m2: number;
}

export const EMPTY_STATS: RunningStats = { count: 0, mean: 0, m2: 0 };

/**
 * One Welford update. Storing every response time would grow without bound and
 * is never read in full; this keeps mean and variance exactly, in three numbers.
 */
export function updateStats(stats: RunningStats, sample: number): RunningStats {
  const count = stats.count + 1;
  const delta = sample - stats.mean;
  const mean = stats.mean + delta / count;
  // Uses both the old and new mean — that is what makes the result exact rather
  // than an approximation that drifts over thousands of updates.
  const m2 = stats.m2 + delta * (sample - mean);
  return { count, mean, m2 };
}

/** Population variance, or 0 before there is anything to vary. */
export function variance(stats: RunningStats): number {
  return stats.count > 0 ? stats.m2 / stats.count : 0;
}

/**
 * Push an outcome onto the recency ring, keeping the newest `RECENT_OUTCOMES`.
 * Oldest first, so the last element is the most recent answer.
 */
export function pushOutcome(outcomes: boolean[], correct: boolean): boolean[] {
  return [...outcomes, correct].slice(-RECENT_OUTCOMES);
}

/**
 * Recent-outcome score, newest answers weighted highest.
 *
 * Linear weights (1, 2, 3, …) rather than exponential decay: with N=10 the
 * difference between them is small, and linear is inspectable — a reader can
 * work out why an item scored what it did without evaluating a decay constant.
 * Returns 0 for no evidence, which is what a new item should score.
 */
export function recencyScore(outcomes: boolean[]): number {
  if (outcomes.length === 0) return 0;

  let weighted = 0;
  let total = 0;
  outcomes.forEach((correct, index) => {
    const weight = index + 1;
    total += weight;
    if (correct) weighted += weight;
  });

  return weighted / total;
}

/**
 * Speed score in 0..1, comparing this item's mean response time against the
 * learner's own baseline for the same exercise type.
 *
 * **Relative to the learner, never to a global constant.** A slow reader is not
 * an unconfident one, and the same absolute millisecond count means different
 * things to different people and on different exercise types — typing romaji is
 * slower than tapping one of four options, always.
 *
 * `0.5` when there is nothing to compare: no samples, or no baseline yet
 * (`LearnerProfile` does not exist — §5.2 [Later]). Neutral rather than 0, so a
 * missing signal neither rewards nor punishes.
 *
 * Three anchors, linear between and clamped outside:
 *
 * | mean vs baseline | score |
 * |---|---|
 * | half as long (twice as fast) | 1 |
 * | **exactly the baseline** | **0.5** |
 * | half again as long | 0 |
 *
 * Answering at your own average scores the same 0.5 as no information at all,
 * which is the point: average speed says nothing either way, so only being
 * faster or slower than yourself moves confidence.
 */
export function speedScore(stats: RunningStats, baselineMs: number | null): number {
  if (stats.count === 0 || baselineMs === null || baselineMs <= 0) return 0.5;

  const ratio = stats.mean / baselineMs;
  return clamp01(1.5 - ratio);
}

export interface ConfidenceInput {
  exposures: number;
  lastNOutcomes: boolean[];
  responseTimeMs: RunningStats;
  /** The learner's mean response time for this exercise type, if known. */
  baselineMs: number | null;
}

/**
 * Confidence in 0..1 (§6.1).
 *
 * Stored rather than computed on read — it is read on every session composition
 * and written only on answer — which makes it a derived field that can drift from
 * its inputs. §5.2 asks for a test that recomputes it from the evidence and
 * compares; `confidence.spec.ts` does exactly that, which is only possible
 * because this function takes evidence and returns a number, with no I/O.
 */
export function computeConfidence(input: ConfidenceInput): number {
  if (input.exposures === 0) return 0;

  const evidence = Math.min(1, input.exposures / EXPOSURES_FOR_FULL_EVIDENCE);
  const observed =
    OUTCOME_WEIGHT * recencyScore(input.lastNOutcomes) +
    SPEED_WEIGHT * speedScore(input.responseTimeMs, input.baselineMs);

  return round2(clamp01(evidence * observed));
}

/**
 * Mastery band for an item, from confidence and how much evidence there is.
 *
 * Distinct from `computeMastery` on `SrsCard`, which bands FSRS *stability* —
 * predicted retention. Both are called "mastery" and they answer different
 * questions; this one is about the learner's demonstrated performance, and it is
 * the one a weakness report should use.
 */
export function computeItemMastery(confidence: number, exposures: number): ItemMasteryLevel {
  if (exposures === 0) return 'new';
  if (confidence < CONFIDENCE_LEARNING_BELOW) return 'learning';
  if (confidence < CONFIDENCE_FAMILIAR_BELOW) return 'familiar';
  return exposures >= EXPOSURES_FOR_FULL_EVIDENCE ? 'mastered' : 'familiar';
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}
