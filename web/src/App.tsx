import { useEffect, useRef, useState } from 'react';

import { fetchLessons, groupByUnit, type Unit } from './api';
import { Curriculum } from './components/Curriculum';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { LessonQuiz } from './components/LessonQuiz';
import { SignIn } from './components/SignIn';
import { armMotion, playHero } from './motion';
import { useRoute } from './useRoute';
import { useSession } from './useSession';

export type Load =
  | { state: 'loading' }
  | { state: 'ready'; units: Unit[] }
  | { state: 'error'; message: string };

export default function App() {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const heroRef = useRef<HTMLElement>(null);
  const route = useRoute();
  const { session, signIn, signUp, signOut, refreshProgress } = useSession();

  useEffect(() => {
    armMotion();
  }, []);

  // Only when the hero is actually mounted — it is not, inside a lesson.
  useEffect(() => {
    if (route.name === 'home' && heroRef.current) playHero(heroRef.current);
  }, [route.name]);

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

  // A lesson is its own screen: no hero, no curriculum list underneath.
  if (route.name === 'lesson') {
    return (
      <>
        <Header session={session} onSignOut={signOut} />
        <main className="wrap lesson-screen">
          {session.state === 'signedIn' ? (
            <LessonQuiz lessonId={route.id} onFinished={() => void refreshProgress()} />
          ) : session.state === 'loading' ? (
            <div className="glass panel note" role="status">
              Checking your session…
            </div>
          ) : (
            <div className="glass panel note">
              <strong>Sign in to take this lesson.</strong>
              <span>Quizzes and progress need an account; browsing the course does not.</span>
              <a className="button" href="#/">
                Back to the course
              </a>
            </div>
          )}
        </main>
      </>
    );
  }

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
      <a className="skip" href="#curriculum">
        Skip to the curriculum
      </a>

      <Header session={session} onSignOut={signOut} />

      <Hero ref={heroRef} totals={totals} />

      {session.state === 'signedOut' ? (
        <section className="section section-tight" id="start">
          <div className="wrap">
            <SignIn onSignIn={signIn} onSignUp={signUp} />
          </div>
        </section>
      ) : null}

      <main id="curriculum">
        <Curriculum
          load={load}
          completedLessonIds={
            session.state === 'signedIn' ? (session.progress?.completedLessonIds ?? []) : null
          }
        />
      </main>

      <footer className="footer">
        <div className="wrap footer-inner">
          <span className="ja footer-mark">日本語</span>
          <p>
            Lessons and progress are the same here as in the Android app — one account, one
            database. Spaced review and the AI tutor are in the app for now.
          </p>
        </div>
      </footer>
    </>
  );
}
