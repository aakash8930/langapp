import { createFileRoute } from '@tanstack/react-router';

import { Achievements } from '../components/Achievements';
import { achievementsFor } from '../gamification';
import { useSession } from '../useSession';

/**
 * The achievements screen.
 *
 * This is the row `Achievements.tsx` was always meant to be, on a page of its
 * own. That component was orphaned when the dashboard took the home address —
 * the dashboard carries `BadgesCard`, a six-tile condensed form with no room
 * for descriptions — and rather than delete it, this route is the place where
 * the full form (goal text, progress slivers, the earned/locked split) belongs.
 *
 * The dashboard's badge shelf deliberately has no "View all" link because there
 * was nothing to link to. There is now, and `BadgesCard` should get one.
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
        <h1 className="page-title">Achievements</h1>
        <p className="page-sub">
          {session.state === 'signedOut'
            ? 'Sign in to see which of these you have earned.'
            : progress
              ? `${earned} of ${badges.length} earned. Locked ones say what they need.`
              : 'Loading your progress…'}
        </p>
      </header>

      {progress ? (
        <Achievements progress={progress} />
      ) : session.state === 'signedOut' ? (
        <p className="card-note">
          Badges are worked out from your XP, streak and completed lessons — there is nothing to
          show without an account.
        </p>
      ) : null}
    </div>
  );
}
