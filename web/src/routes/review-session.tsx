import { createFileRoute } from '@tanstack/react-router';

import { Review } from '../components/Review';
import { ReviewDataGate } from '../components/review/reviewHelpers';
import { ReviewTabs } from '../components/review/ReviewTabs';
import { useSession } from '../useSession';

export const Route = createFileRoute('/review-session')({
  component: ReviewSessionRoute,
});

function ReviewSessionRoute() {
  const { session, refreshProgress } = useSession();
  return <div className="page review-reference"><ReviewTabs active="session" /><header className="review-page-header"><div><p className="review-kicker">FOCUSED RETRIEVAL PRACTICE</p><h1>Review Session</h1><p>Reveal each answer, rate the recall, and let the server FSRS engine calculate the next due date.</p></div></header><ReviewDataGate session={session} pending={false} error={false} onRetry={() => undefined}>{session.state === 'signedIn' ? <Review onFinished={() => void refreshProgress()} audioSpeed={session.user.settings.audioSpeed} /> : null}</ReviewDataGate></div>;
}
