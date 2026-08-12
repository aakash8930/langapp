import { Link } from '@tanstack/react-router';

import type { Session } from '../../useSession';
import { Icon } from '../ui/Icon';

export function ReviewDataGate({ session, pending, error, onRetry, children }: { session: Session; pending: boolean; error: boolean; onRetry: () => void; children: React.ReactNode }) {
  if (session.state === 'loading') return <section className="review-state glass" role="status"><Icon name="refresh-cw" size={42} /><h1>Checking your review account…</h1></section>;
  if (session.state === 'signedOut') return <section className="review-state glass"><Icon name="lock" size={42} /><h1>Sign in to use the Review System</h1><p>Due dates, FSRS state, review events, retention, and forecasts belong to your account.</p><Link className="btn btn-primary" to="/signin">Sign in</Link></section>;
  if (pending) return <section className="review-state glass" role="status"><Icon name="refresh-cw" size={42} /><h1>Loading server-backed review data…</h1></section>;
  if (error) return <section className="review-state glass" role="alert"><Icon name="wifi-off" size={42} /><h1>Review data is unavailable</h1><p>The scheduling API may be asleep. This screen will not substitute sample cards or estimated metrics.</p><button type="button" className="btn btn-secondary" onClick={onRetry}>Try again</button></section>;
  return <>{children}</>;
}
