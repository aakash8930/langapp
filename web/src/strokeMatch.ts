/**
 * Judging a traced stroke against the one KanjiVG says it should be.
 *
 * Pure geometry, no DOM — which is what makes it possible to reason about the
 * tolerances at all. Everything here works in the stroke file's own coordinate
 * space, KanjiVG's `0 0 109 109` viewBox, so the numbers below mean the same
 * thing at any rendered size. A canvas that scales with the screen must convert
 * pointer coordinates into that space before calling in.
 *
 * ## What is actually checked
 *
 * Three things, in the order a teacher would notice them:
 *
 *   1. **Did they draw roughly the right line?** Mean distance between the two
 *      strokes, resampled to the same number of points by arc length. Comparing
 *      raw pointer samples would measure how fast they drew rather than what
 *      they drew — a slow start puts thirty points in the first millimetre.
 *   2. **Did they draw it the right way round?** Checked *before* shape is
 *      rejected, because a backwards stroke is the single most common real
 *      mistake and "wrong direction" is a far more useful thing to be told than
 *      "that was off". Direction is half of what stroke order means.
 *   3. **Was it long enough to be a stroke at all?** A tap is not a failed
 *      stroke, it is not a stroke; it gets ignored rather than marked wrong.
 *
 * What is deliberately *not* checked is speed, pressure, or the number of
 * pointer samples — none of which say anything about handwriting quality here.
 */

export type Point = { x: number; y: number };

export type StrokeVerdict =
  /** Close enough, in the right direction. */
  | 'match'
  /** The right line, drawn end-to-start. */
  | 'reversed'
  /** Not this stroke. */
  | 'off'
  /** Too short to judge — treated as no attempt at all. */
  | 'tooShort';

export type StrokeComparison = {
  verdict: StrokeVerdict;
  /** Mean point-to-point deviation in viewBox units. Infinity when unjudgeable. */
  deviation: number;
};

/**
 * Mean deviation, in viewBox units, that still counts as the right stroke.
 *
 * The viewBox is 109 units across and a typical kana stroke spans 40–80 of
 * them, so 13 is roughly "within a finger's width at the size this renders at".
 * Tightening it below about 9 starts failing strokes that look correct to a
 * person, which makes the feature a nuisance rather than a teacher.
 */
export const MATCH_TOLERANCE = 13;

/**
 * How far out a stroke can be and still be *recognisable* as the target when
 * drawn backwards. Looser than `MATCH_TOLERANCE` on purpose: telling someone
 * they went the wrong way is useful even when their line was also a bit wobbly,
 * and the alternative message ("that was off") would be strictly less true.
 */
const REVERSED_TOLERANCE = 20;

/** Shorter than this, in viewBox units, and it was a tap rather than a stroke. */
const MIN_STROKE_LENGTH = 6;

/** How many points both strokes are resampled to before comparing. */
const SAMPLES = 24;

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Total arc length of a polyline. */
export function polylineLength(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distance(points[i - 1], points[i]);
  return total;
}

/**
 * Resample a polyline to exactly `count` points spaced evenly along its length.
 *
 * This is what makes the comparison about shape rather than about input rate.
 * A degenerate polyline — every sample in the same place, which a stationary
 * press produces — has no length to walk, so it returns that point repeated
 * rather than dividing by zero.
 */
export function resample(points: Point[], count: number = SAMPLES): Point[] {
  if (points.length === 0) return [];
  if (count < 2) return [points[0]];
  if (points.length === 1) return Array.from({ length: count }, () => points[0]);

  const total = polylineLength(points);
  if (total === 0) return Array.from({ length: count }, () => points[0]);

  const step = total / (count - 1);
  const out: Point[] = [points[0]];

  let segment = 1;
  let walked = 0;

  for (let i = 1; i < count - 1; i++) {
    const target = i * step;

    // Walk forward until the target distance falls inside the current segment.
    while (segment < points.length - 1 && walked + distance(points[segment - 1], points[segment]) < target) {
      walked += distance(points[segment - 1], points[segment]);
      segment++;
    }

    const from = points[segment - 1];
    const to = points[segment];
    const segmentLength = distance(from, to);
    // A zero-length segment would put NaN into the output; hold position.
    const t = segmentLength === 0 ? 0 : (target - walked) / segmentLength;

    out.push({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
  }

  out.push(points[points.length - 1]);
  return out;
}

/** Mean distance between two equal-length point lists. */
function meanDeviation(a: Point[], b: Point[]): number {
  if (a.length === 0 || a.length !== b.length) return Infinity;
  let total = 0;
  for (let i = 0; i < a.length; i++) total += distance(a[i], b[i]);
  return total / a.length;
}

/**
 * Compare a drawn stroke against the expected one.
 *
 * `target` is the expected stroke already sampled into points — see
 * `samplePath` in `TraceCanvas`, which gets them out of the SVG itself rather
 * than by parsing path data, so curves are followed exactly as they render.
 */
export function compareStroke(drawn: Point[], target: Point[]): StrokeComparison {
  if (drawn.length < 2 || polylineLength(drawn) < MIN_STROKE_LENGTH) {
    return { verdict: 'tooShort', deviation: Infinity };
  }
  if (target.length < 2) return { verdict: 'off', deviation: Infinity };

  const drawnSamples = resample(drawn);
  const targetSamples = resample(target);

  const forward = meanDeviation(drawnSamples, targetSamples);
  if (forward <= MATCH_TOLERANCE) return { verdict: 'match', deviation: forward };

  // Same line, walked the other way. Checked before giving up, so the learner
  // is told the useful thing rather than the discouraging one.
  const backward = meanDeviation(drawnSamples, [...targetSamples].reverse());
  if (backward <= REVERSED_TOLERANCE && backward < forward) {
    return { verdict: 'reversed', deviation: backward };
  }

  return { verdict: 'off', deviation: Math.min(forward, backward) };
}
