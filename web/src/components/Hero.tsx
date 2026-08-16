import { forwardRef, useEffect, useRef } from 'react';
import './landing/landing.css';
import { Link } from '@tanstack/react-router';
import { logError } from '../debug';
import { countUp, scrollToSection } from '../motion';
import { useSession } from '../useSession';

/**
 * An in-page jump, as a click handler rather than an `href="#id"`.
 *
 * The hash belongs to the router here. `href="#start"` makes the router read
 * `start` as a path, match nothing, and render the not-found screen over the
 * section it just scrolled to — the same defect as the `#/learn/<id>` "Begin"
 * button. See `scrollToSection`.
 *
 * The `href` stays, and is load-bearing: an anchor without one is not focusable
 * and drops out of the tab order entirely. So the element keeps a real `href`
 * for its semantics and the handler suppresses the navigation it would cause.
 * A missing target is logged, because the failure is otherwise a click that
 * does nothing at all.
 */
function jumpTo(id: string) {
  return (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (!scrollToSection(id)) {
      logError('ui', `no #${id} section on this page to scroll to`);
    }
  };
}

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
            <a href="#start" className="btn btn-primary" onClick={jumpTo('start')}>
              Get Started for Free
            </a>
          ) : (
            <Link to="/review" className="btn btn-primary">
              Continue Learning
            </Link>
          )}
          {/*
            A route, not an in-page jump. The curriculum was the bottom of this
            page until the dashboard took the home address; it is `/courses`
            now, and scrolling to a `#curriculum` landmark that no longer exists
            left this button doing nothing but writing a console error.
          */}
          <Link to="/courses" className="btn btn-secondary">
            Explore Curriculum
          </Link>
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
