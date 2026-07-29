import { useCallback, useEffect, useRef, useState } from 'react';

import { compareStroke, type Point, type StrokeVerdict } from '../strokeMatch';
import { useStrokes } from '../strokes';

/**
 * Trace the character, stroke by stroke, and be told whether you got it.
 *
 * ## Why this is graded when the rest of the study screen is not
 *
 * Nothing else on the study screen is graded, on purpose — it is the "learn"
 * half of learn-then-practise. This is the exception, and the reason is that
 * handwriting has no other feedback channel. Reading a character back is
 * checked by the quiz; *writing* one is checked by nobody, and an unchecked
 * tracing box is a colouring-in exercise. The grading is also entirely local
 * and never leaves the browser: no XP, no SRS, no request.
 *
 * ## Strokes must be drawn in order
 *
 * The next expected stroke is the only one being matched against, so drawing
 * the third stroke first fails — which is the whole point of stroke order. A
 * failed attempt does not advance and does not penalise; it is simply not
 * accepted, and the hint appears after two consecutive misses so that a learner
 * who is stuck is shown the answer rather than left guessing.
 *
 * ## Pointer, not mouse
 *
 * Pointer events cover mouse, finger and stylus in one code path, and
 * `setPointerCapture` is what keeps a stroke alive when the finger leaves the
 * box mid-stroke — without it, drawing off the edge silently truncates the
 * stroke and it gets marked wrong for the wrong reason.
 */
export function TraceCanvas({ char }: { char: string }) {
  const strokesQuery = useStrokes(char);
  const svgRef = useRef<SVGSVGElement>(null);
  /** The live ghost paths, used to sample the expected stroke geometry. */
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);

  /** How many strokes have been accepted, in order. */
  const [done, setDone] = useState(0);
  /** The stroke in progress, in viewBox coordinates. */
  const [drawing, setDrawing] = useState<Point[] | null>(null);
  /** Accepted strokes, kept on screen so the character builds up. */
  const [accepted, setAccepted] = useState<Point[][]>([]);
  const [verdict, setVerdict] = useState<StrokeVerdict | null>(null);
  /** Consecutive misses on the current stroke — two shows the hint. */
  const [misses, setMisses] = useState(0);

  const paths = strokesQuery.data?.paths ?? [];
  const total = paths.length;
  const finished = total > 0 && done >= total;

  const reset = useCallback(() => {
    setDone(0);
    setDrawing(null);
    setAccepted([]);
    setVerdict(null);
    setMisses(0);
  }, []);

  // Starting over when the character changes — otherwise the next card opens
  // with the previous character's strokes already ticked off.
  useEffect(() => {
    reset();
  }, [char, reset]);

  /** Screen coordinates → the SVG's own 109×109 space. */
  function toViewBox(event: React.PointerEvent): Point | null {
    const svg = svgRef.current;
    if (!svg) return null;

    const matrix = svg.getScreenCTM();
    if (!matrix) return null;

    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(matrix.inverse());
    return { x: local.x, y: local.y };
  }

  /**
   * Sample the expected stroke off the rendered path element.
   *
   * `getPointAtLength` follows the real curve, so this needs no path-data
   * parser and cannot disagree with what is drawn on screen — the two are
   * literally the same element.
   */
  function sampleExpected(index: number): Point[] {
    const path = pathRefs.current[index];
    if (!path) return [];

    const length = path.getTotalLength();
    if (length === 0) return [];

    const count = 24;
    const out: Point[] = [];
    for (let i = 0; i < count; i++) {
      const at = path.getPointAtLength((length * i) / (count - 1));
      out.push({ x: at.x, y: at.y });
    }
    return out;
  }

  function onPointerDown(event: React.PointerEvent) {
    if (finished || strokesQuery.isError || total === 0) return;
    const point = toViewBox(event);
    if (!point) return;

    // Keeps the stroke alive if the finger leaves the box mid-stroke.
    event.currentTarget.setPointerCapture(event.pointerId);
    setVerdict(null);
    setDrawing([point]);
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!drawing) return;
    const point = toViewBox(event);
    if (!point) return;
    setDrawing([...drawing, point]);
  }

  function onPointerUp() {
    if (!drawing) return;

    const result = compareStroke(drawing, sampleExpected(done));
    setDrawing(null);

    if (result.verdict === 'tooShort') {
      // Not a failed stroke — not a stroke. Say nothing and cost nothing.
      setVerdict(null);
      return;
    }

    setVerdict(result.verdict);

    if (result.verdict === 'match') {
      setAccepted((strokes) => [...strokes, drawing]);
      setDone((n) => n + 1);
      setMisses(0);
    } else {
      setMisses((n) => n + 1);
    }
  }

  if (strokesQuery.isError || (strokesQuery.isSuccess && total === 0)) return null;

  if (strokesQuery.isPending) {
    return <div className="trace trace-loading" aria-hidden="true" />;
  }

  const showHint = misses >= 2 && !finished;

  return (
    <div className="trace">
      <p className="trace-kicker">
        Trace it{' '}
        <span className="trace-count tabular">
          {Math.min(done + (finished ? 0 : 1), total)} / {total}
        </span>
      </p>

      <svg
        ref={svgRef}
        className={`trace-svg${finished ? ' trace-svg-done' : ''}`}
        viewBox={strokesQuery.data.viewBox}
        width={188}
        height={188}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="application"
        aria-label={`Trace ${char}. Stroke ${Math.min(done + 1, total)} of ${total}.`}
      >
        {/* Genkouyoushi quadrant guides — the same placement aid the quiz uses
            for a single kana, and what makes "too far left" visible. */}
        <line className="trace-guide" x1="54.5" y1="0" x2="54.5" y2="109" />
        <line className="trace-guide" x1="0" y1="54.5" x2="109" y2="54.5" />

        {/* Every stroke, faint — the shape to aim at. Also the elements the
            expected geometry is sampled from, so what is judged and what is
            shown cannot drift apart. */}
        {paths.map((d, index) => (
          <path
            key={`ghost-${index}`}
            ref={(element) => {
              pathRefs.current[index] = element;
            }}
            className={`trace-ghost${index === done && !finished ? ' trace-ghost-next' : ''}`}
            d={d}
          />
        ))}

        {/* Strokes already accepted, in the learner's own hand. */}
        {accepted.map((stroke, index) => (
          <polyline key={`done-${index}`} className="trace-done" points={toPoints(stroke)} />
        ))}

        {/* The stroke in progress. */}
        {drawing ? <polyline className="trace-live" points={toPoints(drawing)} /> : null}

        {/* Shown after two misses: the next stroke, solid, so being stuck ends. */}
        {showHint ? <path className="trace-hint" d={paths[done]} /> : null}
      </svg>

      <p className={`trace-verdict trace-verdict-${verdict ?? 'none'}`} role="status">
        {finished
          ? '✓ All strokes, in order.'
          : verdict === 'match'
            ? 'Good — next stroke.'
            : verdict === 'reversed'
              ? 'Right line, wrong way round — start from the other end.'
              : verdict === 'off'
                ? showHint
                  ? 'Not that one. The next stroke is highlighted.'
                  : 'Not that stroke — try the highlighted one.'
                : 'Draw the highlighted stroke.'}
      </p>

      <button className="link-button" type="button" onClick={reset}>
        {finished ? 'Trace it again' : 'Start over'}
      </button>
    </div>
  );
}

/** Polyline `points` attribute from a list of viewBox points. */
function toPoints(stroke: Point[]): string {
  return stroke.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
}
