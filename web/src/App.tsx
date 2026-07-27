import { useEffect, useRef, useState } from 'react';

import { fetchLessons, groupByUnit, type Unit } from './api';
import { Continue } from './components/Continue';
import { Curriculum } from './components/Curriculum';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { LessonQuiz } from './components/LessonQuiz';
import { Review } from './components/Review';
import { SignIn } from './components/SignIn';
import { Study } from './components/Study';
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

  // Reviews are their own screen for the same reason a lesson is: a session
  // you are part-way through should not have a marketing page under it.
  if (route.name === 'review') {
    return (
      <>
        <Header session={session} onSignOut={signOut} />
        <main className="wrap lesson-screen">
          {session.state === 'signedIn' ? (
            <Review
              onFinished={() => void refreshProgress()}
              audioSpeed={session.user.settings.audioSpeed}
            />
          ) : session.state === 'loading' ? (
            <div className="glass panel note" role="status">
              Checking your session…
            </div>
          ) : (
            <div className="glass panel note">
              <strong>Sign in to review.</strong>
              <a className="button" href="#/">
                Back to the course
              </a>
            </div>
          )}
        </main>
      </>
    );
  }

  // The teach step. Unauthenticated on purpose, like the lesson content it
  // shows — browsing the course never needed an account, and this is browsing
  // with better pacing. The quiz behind it still asks for one.
  if (route.name === 'study') {
    return (
      <>
        <Header session={session} onSignOut={signOut} />
        <main className="wrap lesson-screen">
          <Study lessonId={route.id} />
        </main>
      </>
    );
  }

  // A lesson is its own screen: no hero, no curriculum list underneath.
  if (route.name === 'lesson') {
    return (
      <>
        <Header session={session} onSignOut={signOut} />
        <main className="wrap lesson-screen">
          {session.state === 'signedIn' ? (
            // Keyed by lesson id: finishing a lesson can navigate straight into
            // the next one, and without a remount the quiz would keep the
            // finished lesson's state while fetching the new one's questions.
            <LessonQuiz
              key={route.id}
              lessonId={route.id}
              units={load.state === 'ready' ? load.units : []}
              completedLessonIds={session.progress?.completedLessonIds ?? null}
              audioSpeed={session.user.settings.audioSpeed}
              onFinished={() => void refreshProgress()}
            />
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

      {session.state === 'signedIn' && (session.progress?.cardsDueNow ?? 0) > 0 ? (
        <section className="section section-tight">
          <div className="wrap">
            {/*
              The loudest thing on the page when it is here. SRS only works if
              due cards get cleared before new material is added, so this has to
              out-shout a list of tempting new lessons.
            */}
            <a className="due-callout" href="#/review">
              <span className="due-count tabular">{session.progress?.cardsDueNow}</span>
              <span>
                <strong>Cards are due</strong>
                <span>Clear these before starting something new.</span>
              </span>
            </a>
          </div>
        </section>
      ) : null}

      {session.state === 'signedIn' ? (
        <section className="section section-tight">
          <div className="wrap">
            <Continue
              units={load.state === 'ready' ? load.units : []}
              progress={session.progress}
            />
          </div>
        </section>
      ) : null}

      <main id="curriculum">
        <Curriculum
          load={load}
          completedLessonIds={
            session.state === 'signedIn' ? (session.progress?.completedLessonIds ?? []) : null
          }
          learnId={route.learn ?? null}
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
