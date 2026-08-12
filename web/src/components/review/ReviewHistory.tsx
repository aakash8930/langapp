import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { fetchReviewEvents } from '../../api';
import { queryKeys } from '../../queryKeys';
import { useSession } from '../../useSession';
import { Icon } from '../ui/Icon';
import { formatDurationMs, formatInterval, reviewItemCopy } from './reviewFormatters';
import { ReviewDataGate } from './reviewHelpers';
import { ReviewTabs } from './ReviewTabs';

import './review.css';

export function ReviewHistory() {
  const { session } = useSession();
  const [limit, setLimit] = useState(50);
  const enabled = session.state === 'signedIn';
  const events = useQuery({ queryKey: queryKeys.reviews.events(limit), queryFn: () => fetchReviewEvents(limit), enabled });
  return <div className="page review-reference"><ReviewTabs active="history" /><header className="review-page-header"><div><p className="review-kicker">APPEND-ONLY SERVER EVENTS</p><h1>Review History</h1><p>Every row below is a persisted grade event. Newer events include the state and due-date transition used to debug scheduling without exposing FSRS stability or difficulty.</p></div><label className="review-limit-select"><span>Rows</span><select value={limit} onChange={(event) => setLimit(Number(event.target.value))}><option value={50}>Latest 50</option><option value={100}>Latest 100</option><option value={200}>Latest 200</option></select></label></header><ReviewDataGate session={session} pending={events.isPending && enabled} error={events.isError} onRetry={() => void events.refetch()}>{events.data ? events.data.length === 0 ? <section className="review-state glass"><Icon name="history" size={42} /><h2>No review events yet</h2><p>Complete a due review to create the first server-backed history record.</p></section> : <section className="review-history-card glass"><div className="review-section-head"><div><p className="review-kicker">NEWEST FIRST</p><h2>Confirmed grades</h2></div><span>{events.data.length} loaded</span></div><ol>{events.data.map((entry) => { const copy = entry.item ? reviewItemCopy(entry.item) : null; return <li key={entry.id}><time dateTime={entry.reviewedAt}><strong>{new Date(entry.reviewedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</strong><small>{new Date(entry.reviewedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</small></time><span className={`review-grade-badge is-${entry.grade ?? 'unknown'}`}>{entry.grade ?? 'legacy'}</span><span className="review-history-item"><strong className={copy ? 'ja' : ''} lang={copy ? 'ja' : undefined}>{copy?.front ?? 'Content unavailable'}</strong><small>{copy ? `${copy.reading ? `${copy.reading} · ` : ''}${copy.back}` : entry.itemId ?? 'No content identifier recorded'}</small></span><span className="review-history-transition"><strong>{entry.previousState && entry.newState ? `${entry.previousState} → ${entry.newState}` : entry.newState ?? 'State not recorded'}</strong><small>{formatInterval(entry.intervalMinutes)} · {formatDurationMs(entry.responseTimeMs)}</small></span><span className="review-history-due"><strong>{entry.newDue ? new Date(entry.newDue).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '—'}</strong><small>{entry.wasDue === false ? 'Not due when graded' : entry.wasDue === true ? 'Was due' : 'Due status legacy'}</small></span></li>; })}</ol><footer><p>Older events are not deleted; this view loads a bounded newest-first window.</p>{limit < 200 && events.data.length === limit ? <button type="button" className="btn btn-secondary" onClick={() => setLimit(limit === 50 ? 100 : 200)}>Load more</button> : null}</footer></section> : null}</ReviewDataGate></div>;
}
