import { forwardRef, useEffect, useRef } from 'react';

import { countUp } from '../motion';

type Totals = { units: number; lessons: number; items: number } | null;

/**
 * The one screen of the site that is purely presentational.
 *
 * 日本語 is set in three genkouyoushi cells — the manuscript square from the app
 * and the workflow deck, which is the strongest piece of identity this product
 * has. The glass sits *over* the page's grid so the blur has something to bend,
 * which is the whole reason the grid is a fixed background rather than decoration.
 */
export const Hero = forwardRef<HTMLElement, { totals: Totals }>(function Hero({ totals }, ref) {
  return (
    <header className="hero" ref={ref}>
      <div className="wrap hero-inner">
        <p className="eyebrow" data-hero-line>
          Japanese, from the first character
        </p>

        <div className="hero-cells" aria-hidden="true">
          {['日', '本', '語'].map((glyph) => (
            <span className="cell ja" key={glyph} data-hero-cell>
              {glyph}
            </span>
          ))}
        </div>

        <h1 className="hero-title" data-hero-line>
          Learn to read Japanese <em>before</em> you learn to guess it.
        </h1>

        <p className="hero-lede" data-hero-line>
          Every word in this course is spelled with characters the course has already taught.
          Nothing appears on screen that you have not been given the means to read — which is
          rarer than it sounds, and it is why the word list looks the way it does.
        </p>

        <div className="hero-stats glass" data-hero-line>
          <Stat value={totals?.units ?? null} label="Units" ja="単元" />
          <Stat value={totals?.lessons ?? null} label="Lessons" ja="レッスン" />
          <Stat value={totals?.items ?? null} label="Things to learn" ja="項目" />
        </div>
      </div>
    </header>
  );
});

function Stat({ value, label, ja }: { value: number | null; label: string; ja: string }) {
  const numberRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (value === null || !numberRef.current) return;
    countUp(numberRef.current, value);
  }, [value]);

  return (
    <div className="stat">
      {/*
        The count animates from 0, so a screen reader would otherwise hear it
        tick. The accessible name is the final number, stated once.
      */}
      <span className="stat-value tabular" aria-hidden="true" ref={numberRef}>
        {value === null ? '—' : 0}
      </span>
      <span className="visually-hidden">{value === null ? 'loading' : value}</span>
      <span className="stat-label">{label}</span>
      <span className="stat-ja ja">{ja}</span>
    </div>
  );
}
