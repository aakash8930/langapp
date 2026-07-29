import { forwardRef, useEffect, useRef } from 'react';
import { Link } from '@tanstack/react-router';
import { countUp } from '../motion';
import { useSession } from '../useSession';

type Totals = { units: number; lessons: number; items: number } | null;

export const Hero = forwardRef<HTMLElement, { totals: Totals }>(function Hero({ totals }, ref) {
  const { session } = useSession();

  return (
    <header className="hero" ref={ref}>
      <div className="wrap hero-inner">
        <p className="eyebrow" data-hero-line>
          Next-Gen Learning Platform
        </p>

        <h1 className="hero-title" data-hero-line>
          Learn to read Japanese <em>intelligently</em> and beautifully.
        </h1>

        <p className="hero-lede" data-hero-line>
          Master the language with advanced spaced repetition algorithms, AI-powered conversational practice, and a beautiful interface designed to keep you motivated every single day.
        </p>

        <div style={{ display: 'flex', gap: '16px', marginTop: '16px', flexWrap: 'wrap', justifyContent: 'center' }} data-hero-line>
          {session.state === 'signedOut' ? (
            <a href="#start" className="btn btn-primary">
              Get Started for Free
            </a>
          ) : (
            <Link to="/review" className="btn btn-primary">
              Continue Learning
            </Link>
          )}
          <a href="#curriculum" className="btn btn-secondary">
            Explore Curriculum
          </a>
        </div>

        <div className="hero-stats glass" data-hero-line style={{ marginTop: '32px' }}>
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
      <span className="stat-value tabular" aria-hidden="true" ref={numberRef}>
        {value === null ? '—' : 0}
      </span>
      <span className="visually-hidden">{value === null ? 'loading' : value}</span>
      <span className="stat-label">{label}</span>
      <span className="stat-ja ja">{ja}</span>
    </div>
  );
}
