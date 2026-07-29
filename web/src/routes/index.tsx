import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';

import { fetchLessons, groupByUnit, type Unit } from '../api';
import { Continue } from '../components/Continue';
import { Curriculum, type Load } from '../components/Curriculum';
import { Hero } from '../components/Hero';
import { SignIn } from '../components/SignIn';
import { playHero } from '../motion';
import { useSession } from '../useSession';

/**
 * The home route. The marketing page and the unauthenticated one are the same
 * screen — the components that depend on session state render only when the
 * session is signed-in, and the rest of the page is the course catalog.
 *
 * Loader runs once per `staleTime` (default 0 — the catalog is public and
 * cheap, so we re-fetch on every visit). Task #10 will move this behind
 * TanStack Query so the cache survives navigation.
 *
 * The search param `learn` carries a lesson id whose row should auto-open and
 * scroll into view — the only flow that produces it is finishing a lesson whose
 * successor has not been learned yet. Passing it through the URL keeps the
 * intent visible in a log line and survives a refresh.
 */
export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): { learn?: string } => {
    const raw = search['learn'];
    return typeof raw === 'string' ? { learn: raw } : {};
  },
  loader: async (): Promise<Load> => {
    try {
      const lessons = await fetchLessons();
      return { state: 'ready', units: groupByUnit(lessons) };
    } catch (error: unknown) {
      return {
        state: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Something stopped the curriculum loading.',
      };
    }
  },
  component: HomePage,
});

function HomePage() {
  const data = Route.useLoaderData();
  const { learn } = Route.useSearch();
  const { session, signIn, signUp } = useSession();
  const heroRef = useRef<HTMLElement>(null);

  // The hero only plays on the home mount. The shell keeps mounted across
  // navigation, so this runs on every push to `/`, not on every render.
  useEffect(() => {
    if (heroRef.current) playHero(heroRef.current);
  }, []);

  const units: Unit[] = data.state === 'ready' ? data.units : [];

  const totals =
    data.state === 'ready'
      ? {
          units: data.units.length,
          lessons: data.units.reduce((n, unit) => n + unit.lessons.length, 0),
          items: data.units.reduce((n, unit) => n + unit.itemCount, 0),
        }
      : null;

  return (
    <>
      <a className="skip" href="#curriculum">
        Skip to the curriculum
      </a>

      <Hero ref={heroRef} totals={totals} />

      {session.state === 'signedOut' ? (
        <section className="section section-tight" id="start">
          <div className="wrap">
            <SignIn onSignIn={signIn} onSignUp={signUp} />
          </div>
        </section>
      ) : null}

      {session.state === 'signedIn' && (session.progress?.cardsDueNow ?? 0) > 0 ? (
        <section className="section section-tight">
          <div className="wrap">
            {/*
              The loudest thing on the page when it is here. SRS only works if
              due cards get cleared before new material is added, so this has to
              out-shout a list of tempting new lessons.
            */}
            <Link className="due-callout" to="/review">
              <span className="due-count tabular">{session.progress?.cardsDueNow}</span>
              <span>
                <strong>Cards are due</strong>
                <span>Clear these before starting something new.</span>
              </span>
            </Link>
          </div>
        </section>
      ) : null}

      {session.state === 'signedIn' ? (
        <section className="section section-tight">
          <div className="wrap">
            <Continue units={units} progress={session.progress} />
          </div>
        </section>
      ) : null}

      <main id="curriculum">
        <Curriculum
          load={data}
          completedLessonIds={
            session.state === 'signedIn' ? (session.progress?.completedLessonIds ?? []) : null
          }
          learnId={learn ?? null}
        />
      </main>

      <footer className="footer">
        <div className="wrap footer-inner">
          <span className="ja footer-mark">日本語</span>
          <p>
            Lessons, reviews and progress are the same here as in the Android app — one
            account, one database. The AI tutor is in the app for now.
          </p>
        </div>
      </footer>
    </>
  );
}