import { useEffect, useRef, useState } from 'react';

import { fetchLessons, groupByUnit, type Unit } from './api';
import { Curriculum } from './components/Curriculum';
import { Hero } from './components/Hero';
import { armMotion, playHero } from './motion';

export type Load =
  | { state: 'loading' }
  | { state: 'ready'; units: Unit[] }
  | { state: 'error'; message: string };

export default function App() {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const heroRef = useRef<HTMLElement>(null);

  // Armed before anything animates: this is what adds `js-motion`, and without
  // it every `.reveal` element stays plainly visible instead of hidden.
  useEffect(() => {
    armMotion();
    if (heroRef.current) playHero(heroRef.current);
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchLessons()
      .then((lessons) => {
        if (!cancelled) setLoad({ state: 'ready', units: groupByUnit(lessons) });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoad({
          state: 'error',
          message:
            error instanceof Error ? error.message : 'Something stopped the curriculum loading.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const totals =
    load.state === 'ready'
      ? {
          units: load.units.length,
          lessons: load.units.reduce((n, unit) => n + unit.lessons.length, 0),
          items: load.units.reduce((n, unit) => n + unit.itemCount, 0),
        }
      : null;

  return (
    <>
      {/* First tab stop — the curriculum below is a long list to skip past. */}
      <a className="skip" href="#curriculum">
        Skip to the curriculum
      </a>

      <Hero ref={heroRef} totals={totals} />

      <main id="curriculum">
        <Curriculum load={load} />
      </main>

      <footer className="footer">
        <div className="wrap footer-inner">
          <span className="ja footer-mark">日本語</span>
          <p>
            Every lesson above is read live from the langapp API. This page shows the public
            content only — progress, spaced repetition and the AI tutor live in the app.
          </p>
        </div>
      </footer>
    </>
  );
}
