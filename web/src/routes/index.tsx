import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { lazy, Suspense, useEffect, useRef } from 'react';

import { fetchLessons, groupByUnit, type Unit } from '../api';
import { Footer } from '../components/layout/Footer';
import { FeaturesSection } from '../components/landing/FeaturesSection';
import { HowItWorks } from '../components/landing/HowItWorks';
import { JLPTPrepSection } from '../components/landing/JLPTPrepSection';
import { PricingPreview } from '../components/landing/PricingPreview';
import { TestimonialsSection } from '../components/landing/TestimonialsSection';
import { FaqPreview } from '../components/landing/FaqPreview';
import { Hero } from '../components/Hero';
import { playHero } from '../motion';
import { queryKeys } from '../queryKeys';
import { useSession } from '../useSession';

const LazyDashboard = lazy(() =>
  import('../components/dashboard').then((module) => ({ default: module.Dashboard })),
);

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  const { session } = useSession();
  const lessonsQuery = useQuery({
    queryKey: queryKeys.lessons.all,
    queryFn: fetchLessons,
    enabled: session.state === 'signedIn',
  });
  const units: Unit[] = lessonsQuery.data ? groupByUnit(lessonsQuery.data) : [];

  if (session.state === 'loading') {
    return <DashboardSkeleton />;
  }

  if (session.state === 'signedOut') {
    return <ShopWindow units={units} />;
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
      {lessonsQuery.isError ? (
        // The catalog failing does not empty the dashboard: the streak, the
        // goal, the level and the review queue all come from elsewhere. Only
        // the three lesson-driven cards go quiet, so this says which.
        <p className="note note-error dashboard-warning">
          <strong>The course catalog could not be loaded.</strong>
          <span>
            {lessonsQuery.error instanceof Error ? lessonsQuery.error.message : 'The catalog request failed.'}
            {' '}Your progress is still shown — what to study next is not. The API may be asleep.
          </span>
        </p>
      ) : null}

      <Suspense fallback={<DashboardSkeleton />}>
        <LazyDashboard
          units={units}
          progress={session.progress}
          tz={session.user.settings.tz}
        />
      </Suspense>
    </>
  );
}

/**
 * The signed-out home: hero, product detail, then dedicated auth links.
 *
 * `#start` is the one in-page anchor left on this screen, and `Hero`'s button
 * scrolls to it with `scrollToSection` rather than writing the hash — the hash
 * is the router's address bar, and `href="#start"` makes it read `start` as a
 * path, match nothing, and render not-found over the section it just scrolled
 * to.
 */
function ShopWindow({ units }: { units: Unit[] }) {
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
          <div className="panel glass signin">
            <p className="eyebrow">START YOUR JOURNEY</p>
            <h2>Ready to make Japanese stick?</h2>
            <p>Build a personal course, keep your progress in sync, and continue on any device.</p>
            <div className="hero-actions">
              <Link to="/signup" className="btn btn-primary">Create an account</Link>
              <Link to="/signin" className="btn btn-secondary">Sign in</Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

/** Uses only global shell styles so dashboard CSS stays in its lazy chunk. */
function DashboardSkeleton() {
  return (
    <main className="page" aria-busy="true" aria-live="polite">
      <section className="panel glass">
        <p className="eyebrow">YOUR LEARNING SPACE</p>
        <h1>Loading your dashboard…</h1>
      </section>
    </main>
  );
}
