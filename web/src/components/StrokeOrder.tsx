import { useState } from 'react';

import { useStrokes } from '../strokes';

/**
 * How a character is written: the strokes, in order, drawn one after another.
 *
 * ## Drawn, not listed
 *
 * The alternative — numbered arrows on a static glyph, the way a textbook does
 * it — has to be decoded before it teaches anything. An animation is the thing
 * itself: the hand goes where the line goes. This is also the one place the
 * course can show *direction*, which a printed character cannot carry at all
 * and which is half of what stroke order means.
 *
 * ## Animated with dash offset
 *
 * Each path is drawn by animating `stroke-dashoffset` from its own length to
 * zero, staggered so stroke two starts just after stroke one lands. No library:
 * this is the technique SVG line-drawing has always used, and pulling in an
 * animation dependency to do it would be the tail wagging the dog.
 *
 * Timings are set to be *watchable*. The first pass drew each stroke in 400ms,
 * which was reported as too fast — and it was: the point is to follow the line
 * with your eye and know where the next one starts, not to see a finished
 * character appear. 750ms a stroke, with the next beginning just after the last
 * lands, is closer to writing speed.
 *
 * `pathLength="1"` normalises every path to a unit length, which is what lets a
 * single CSS rule animate strokes of wildly different real lengths at the same
 * visual speed — without it, 山's long vertical would crawl while its short
 * ticks snapped.
 *
 * Under reduced motion the whole character is simply shown complete. Holding a
 * partially-drawn glyph on screen would be worse than not animating.
 */
export function StrokeOrder({ char, size = 132 }: { char: string; size?: number }) {
  /** Bumped to replay: remounting the paths restarts the CSS animation. */
  const [run, setRun] = useState(0);

  // Shared with `TraceCanvas`, which draws the same glyph beside this one. The
  // cache is what makes that one request rather than two.
  const strokesQuery = useStrokes(char);

  // A character with no stroke data shows without a diagram. That is the
  // designed fallback, not an error worth a banner — the character itself is
  // already on screen above this.
  if (strokesQuery.isError) return null;

  const data = strokesQuery.data;
  if (!data) {
    return <div className="strokes strokes-loading" style={{ width: size, height: size }} />;
  }

  return (
    <div className="strokes-wrap">
      <svg
        className="strokes"
        viewBox={data.viewBox}
        width={size}
        height={size}
        role="img"
        aria-label={`How to write ${char}: ${data.paths.length} strokes`}
      >
        {/* The finished character, faint, underneath — so the animation draws
            into a shape rather than into empty space, and the learner can see
            where a stroke is going before it gets there. */}
        {data.paths.map((d, index) => (
          <path key={`ghost-${index}`} className="stroke-ghost" d={d} pathLength={1} />
        ))}
        {data.paths.map((d, index) => (
          <path
            key={`${run}-${index}`}
            className="stroke-draw"
            d={d}
            pathLength={1}
            style={{ animationDelay: `${index * 0.82}s` }}
          />
        ))}
      </svg>

      <div className="strokes-foot">
        <button className="link-button" type="button" onClick={() => setRun((n) => n + 1)}>
          Replay
        </button>
        <span className="strokes-count tabular">
          {data.paths.length} {data.paths.length === 1 ? 'stroke' : 'strokes'}
        </span>
      </div>

      {/*
        The credit, where the strokes are — not three taps away in a settings
        screen. KanjiVG is CC BY-SA 3.0 and attribution is the obligation; see
        NOTICE at the repo root.
      */}
      <p className="strokes-credit">
        Stroke order:{' '}
        <a href="https://kanjivg.tagaini.net/" target="_blank" rel="noreferrer noopener">
          KanjiVG
        </a>
        , <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noreferrer noopener">CC BY-SA 3.0</a>
      </p>
    </div>
  );
}
