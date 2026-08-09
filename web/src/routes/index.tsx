import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';

import { fetchLessons, groupByUnit, type Unit } from '../api';
import { Dashboard } from '../components/dashboard';
import { Footer } from '../components/layout/Footer';
import { FeaturesSection } from '../components/landing/FeaturesSection';
import { HowItWorks } from '../components/landing/HowItWorks';
import { JLPTPrepSection } from '../components/landing/JLPTPrepSection';
import { PricingPreview } from '../components/landing/PricingPreview';
import { TestimonialsSection } from '../components/landing/TestimonialsSection';
import { FaqPreview } from '../components/landing/FaqPreview';
import '../components/landing/landing.css';
import { Hero } from '../components/Hero';
import { SignIn } from '../components/SignIn';
import { log, logError } from '../debug';
import { playHero } from '../motion';
import { queryKeys } from '../queryKeys';
import { useSession } from '../useSession';

type Load =
  | { state: 'ready'; units: Unit[] }
  | { state: 'error'; message: string };

/**
 * The home route, and now two different screens behind one address.
 *
 * **Signed in, it is the dashboard.** **Signed out, it is the shop window** —
 * the hero and the sign-in form, which is where the header's "Sign in" button
 * points precisely because `/` *is* the sign-in screen when there is no session.
 *
 * The course catalog used to be the bottom two-thirds of this page and now
 * lives at `/courses`. Nothing about it changed in the move except the address,
 * and one consequence is load-bearing: **`?learn=` belongs to `/courses` now.**
 * This route deliberately declares no search params, so a `learn` left on `/`
 * is dropped rather than half-honoured. Its two writers — the dashboard's
 * Continue card and the end of a lesson — both point at `/courses`.
 *
 * The loader still runs for signed-out visitors, because the hero's three
 * counters come from the catalog and browsing is public. It is the same cached
 * query the dashboard and `/courses` read, so arriving at any of the three
 * warms the other two.
 */
export const Route = createFileRoute('/')({
  loader: async ({ context }): Promise<Load> => {
    try {
      // `ensureQueryData` returns the cached value if fresh, otherwise fetches
      // and stores it. The 30s default stale time means a back-navigation
      // within half a minute reads from the cache.
      const lessons = await context.queryClient.ensureQueryData({
        queryKey: queryKeys.lessons.all,
        queryFn: fetchLessons,
      });
      const units = groupByUnit(lessons);
      log('route', 'home loader: catalog ready', {
        lessons: lessons.length,
        units: units.map((unit) => `${unit.slug}(${unit.lessons.length})`),
      });
      return { state: 'ready', units };
    } catch (error: unknown) {
      // The loader deliberately resolves rather than throwing, so the page can
      // render its own error state instead of the router's boundary. That also
      // means nothing else would log this.
      logError('route', 'home loader: catalog failed to load', error);
      return {
        state: 'error',
        message:
          error instanceof Error ? error.message : 'Something stopped the catalog loading.',
      };
    }
  },
  component: HomePage,
});

function HomePage() {
  const data = Route.useLoaderData();
  const { session, signIn, signUp } = useSession();

  const units: Unit[] = data.state === 'ready' ? data.units : [];

  if (session.state === 'loading') {
    return <DashboardSkeleton />;
  }

  if (session.state === 'signedOut') {
    return <ShopWindow onSignIn={signIn} onSignUp={signUp} units={units} />;
  }

  /*
   * Signed in, but `/me/progress` has not landed yet.
   *
   * Every card on the dashboard is a rendering of a figure from that one
   * response, so there is nothing to draw half of — which is why `Dashboard`
   * takes a non-null `Progress` rather than eleven components each guarding
   * for it.
   */
  if (!session.progress) {
    return <DashboardSkeleton />;
  }

  return (
    <>
      {data.state === 'error' ? (
        // The catalog failing does not empty the dashboard: the streak, the
        // goal, the level and the review queue all come from elsewhere. Only
        // the three lesson-driven cards go quiet, so this says which.
        <p className="note note-error dashboard-warning">
          <strong>The course catalog could not be loaded.</strong>
          <span>
            {data.message} Your progress is still shown — what to study next is not. The API may
            be asleep.
          </span>
        </p>
      ) : null}

      <Dashboard
        units={units}
        progress={session.progress}
        tz={session.user.settings.tz}
      />
    </>
  );
}

/**
 * The signed-out home: hero, then the sign-in form.
 *
 * `#start` is the one in-page anchor left on this screen, and `Hero`'s button
 * scrolls to it with `scrollToSection` rather than writing the hash — the hash
 * is the router's address bar, and `href="#start"` makes it read `start` as a
 * path, match nothing, and render not-found over the section it just scrolled
 * to.
 */
function ShopWindow({
  units,
  onSignIn,
  onSignUp,
}: {
  units: Unit[];
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (
    email: string,
    password: string,
    displayName: string,
    dateOfBirth: string,
  ) => Promise<void>;
}) {
  const heroRef = useRef<HTMLElement>(null);

  // The shell stays mounted across navigation, so this runs on each arrival at
  // `/` rather than on every render.
  useEffect(() => {
    if (heroRef.current) playHero(heroRef.current);
  }, []);

  const totals = {
    units: units.length,
    lessons: units.reduce((n, unit) => n + unit.lessons.length, 0),
    items: units.reduce((n, unit) => n + unit.itemCount, 0),
  };

  return (
    <div className="page">
      <Hero ref={heroRef} totals={units.length > 0 ? totals : null} />

      <FeaturesSection />
      <HowItWorks />
      <JLPTPrepSection />
      <PricingPreview />
      <TestimonialsSection />
      <FaqPreview />

      <section className="section section-tight" id="start">
        <div className="wrap">
          <SignIn onSignIn={onSignIn} onSignUp={onSignUp} />
        </div>
      </section>

      <Footer />
    </div>
  );
}

/**
 * The dashboard's loading state.
 *
 * Blocks rather than a spinner, and in the dashboard's own proportions: the
 * page it becomes has a wide column and a narrow one, and a layout that
 * reshuffles the moment data lands reads as a glitch. Nothing here animates —
 * a shimmer under `prefers-reduced-motion` is exactly the kind of decoration
 * the site's motion rule turns off.
 */
function DashboardSkeleton() {
  return (
    <div className="dashboard" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading your dashboard…</span>

      <section className="dashboard-main" aria-label="Loading learning dashboard">
        <div className="dashboard-main-header">
          <span className="skeleton-line skeleton-line-kicker" />
          <span className="skeleton-line skeleton-line-title" />
          <span className="skeleton-line skeleton-line-subtitle" />
        </div>
        <span className="skeleton-card skeleton-card-wide" />
        <div className="dashboard-progress-grid">
          <span className="skeleton-card" />
          <span className="skeleton-card" />
        </div>
        <div className="dashboard-action-grid">
          <span className="skeleton-card skeleton-card-tall" />
          <span className="skeleton-card" />
        </div>
        <span className="skeleton-card skeleton-card-wide" />
      </section>

      <aside className="dashboard-side" aria-label="Loading account status">
        <span className="skeleton-card" />
        <span className="skeleton-card" />
        <span className="skeleton-card skeleton-card-tall" />
      </aside>
    </div>
  );
}
