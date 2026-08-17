import { createFileRoute } from '@tanstack/react-router';

import { GamificationHub } from '../components/GamificationHub';
import { achievementsFor } from '../gamification';
import { useSession } from '../useSession';

/**
 * The achievements screen.
 *
 * The full form of the badge shelf (goal text, progress slivers, the
 * earned/locked split) lives here, on a page of its own, rather than as a
 * condensed card on the dashboard. The dashboard was reduced to its essential
 * path after learner testing, and badges remain one click away from the
 * sidebar.
 *
 * Every tick is derived from `/me/progress` on render and stored nowhere; see
 * `gamification.ts` for the three badges that were dropped rather than faked,
 * and what each would need from the API first.
 */
export const Route = createFileRoute('/achievements')({
  component: AchievementsPage,
});

function AchievementsPage() {
  const { session } = useSession();

  const progress = session.state === 'signedIn' ? session.progress : null;
  const badges = progress ? achievementsFor(progress) : [];
  const earned = badges.filter((badge) => badge.unlocked).length;

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">Gamification</h1>
        <p className="page-sub">
          {session.state === 'signedOut'
            ? 'Sign in to see which of these you have earned.'
            : progress
              ? `${earned} of ${badges.length} earned. Locked ones say what they need.`
              : 'Loading your progress…'}
        </p>
      </header>

      {progress ? (
        <GamificationHub progress={progress} />
      ) : session.state === 'signedOut' ? (
        <p className="card-note">
          Badges are worked out from your XP, streak and completed lessons — there is nothing to
          show without an account.
        </p>
      ) : null}
    </div>
  );
}
