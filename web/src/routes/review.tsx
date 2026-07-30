import { createFileRoute, Link } from '@tanstack/react-router';

import { Review } from '../components/Review';
import { useSession } from '../useSession';

/**
 * The review session. A learner is part-way through grading and shouldn't
 * have a marketing page under them.
 */
export const Route = createFileRoute('/review')({
  component: ReviewRoute,
});

function ReviewRoute() {
  const { session, refreshProgress } = useSession();

  if (session.state === 'signedIn') {
    return (
      <Review
        onFinished={() => void refreshProgress()}
        audioSpeed={session.user.settings.audioSpeed}
      />
    );
  }

  if (session.state === 'loading') {
    return (
      <main className="wrap lesson-screen">
        <div className="glass panel note" role="status">
          Checking your session…
        </div>
      </main>
    );
  }

  return (
    <main className="wrap lesson-screen">
      <div className="glass panel note">
        <strong>Sign in to review.</strong>
        <Link className="btn btn-primary" to="/">
          Back to the course
        </Link>
      </div>
    </main>
  );
}
