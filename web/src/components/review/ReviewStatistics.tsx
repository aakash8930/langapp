import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { fetchReviewStatistics, type ReviewGrade } from '../../api';
import { queryKeys } from '../../queryKeys';
import { useSession } from '../../useSession';
import { formatDurationMs } from './reviewFormatters';
import { ReviewDataGate } from './reviewHelpers';
import { ReviewTabs } from './ReviewTabs';

import './review.css';

const gradeLabels: { id: ReviewGrade; label: string; note: string }[] = [
  { id: 'again', label: 'Again', note: 'Failed recall' },
  { id: 'hard', label: 'Hard', note: 'Difficult recall' },
  { id: 'good', label: 'Good', note: 'Successful recall' },
  { id: 'easy', label: 'Easy', note: 'Immediate recall' },
];

export function ReviewStatistics() {
  const { session } = useSession();
  const [days, setDays] = useState(30);
  const enabled = session.state === 'signedIn';
  const statistics = useQuery({ queryKey: queryKeys.reviews.statistics(days), queryFn: () => fetchReviewStatistics(days), enabled });
  const maxGrade = statistics.data ? Math.max(1, ...Object.values(statistics.data.grades)) : 1;
  return <div className="page review-reference"><ReviewTabs active="statistics" /><header className="review-page-header"><div><p className="review-kicker">OBSERVED REVIEW PERFORMANCE</p><h1>Review Statistics</h1><p>Counts come from persisted grades in your selected local-calendar window. Card-state and mastery totals come from the current server schedule.</p></div><label className="review-limit-select"><span>Window</span><select value={days} onChange={(event) => setDays(Number(event.target.value))}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></label></header><ReviewDataGate session={session} pending={statistics.isPending && enabled} error={statistics.isError} onRetry={() => void statistics.refetch()}>{statistics.data ? <><section className="review-stat-band is-four"><article className="glass"><span>Reviews completed</span><strong className="tabular">{statistics.data.reviewsCompleted}</strong><small>Confirmed grade events</small></article><article className="glass"><span>Observed success</span><strong className="tabular">{statistics.data.observedSuccessRate === null ? '—' : `${Math.round(statistics.data.observedSuccessRate * 100)}%`}</strong><small>Good + Easy</small></article><article className="glass"><span>Average response</span><strong className="tabular">{formatDurationMs(statistics.data.averageResponseTimeMs)}</strong><small>{statistics.data.timingSamples} timed samples</small></article><article className="glass"><span>Due / overdue now</span><strong className="tabular">{statistics.data.dueNow} / {statistics.data.overdueNow}</strong><small>Current queue snapshot</small></article></section><div className="review-statistics-layout"><main><section className="review-grade-chart glass"><div className="review-section-head"><div><p className="review-kicker">RATINGS · {statistics.data.days} DAYS</p><h2>Grade distribution</h2></div><span>{statistics.data.reviewsCompleted} total</span></div><div>{gradeLabels.map((grade) => <article key={grade.id}><span className={`review-grade-badge is-${grade.id}`}>{grade.label}</span><div><i style={{ width: `${statistics.data.grades[grade.id] / maxGrade * 100}%` }} /></div><strong className="tabular">{statistics.data.grades[grade.id]}</strong><small>{grade.note}</small></article>)}</div></section><section className="review-current-model glass"><div className="review-section-head"><div><p className="review-kicker">CURRENT SERVER MODEL</p><h2>Card states and mastery bands</h2></div><span>{statistics.data.totalCards} cards</span></div><div><article><h3>Scheduling state</h3><dl><div><dt>New</dt><dd>{statistics.data.states.new}</dd></div><div><dt>Learning</dt><dd>{statistics.data.states.learning}</dd></div><div><dt>Review</dt><dd>{statistics.data.states.review}</dd></div><div><dt>Relearning</dt><dd>{statistics.data.states.relearning}</dd></div></dl></article><article><h3>Human-facing mastery</h3><dl><div><dt>New</dt><dd>{statistics.data.mastery.new}</dd></div><div><dt>Learning</dt><dd>{statistics.data.mastery.learning}</dd></div><div><dt>Familiar</dt><dd>{statistics.data.mastery.familiar}</dd></div><div><dt>Mastered</dt><dd>{statistics.data.mastery.mastered}</dd></div></dl></article></div></section></main><aside className="review-side-stack"><section className="review-rail-card glass"><p className="review-kicker">SUCCESS DEFINITION</p><h2>Good or Easy</h2><p>The current server&rsquo;s observed-success counter treats Good and Easy as successful. Hard is preserved as its own real rating rather than silently folded into accuracy.</p></section><section className="review-rail-card glass"><p className="review-kicker">NOT SHOWN</p><h2>No invented streak or forgotten count</h2><p>The Review API does not expose a review-only streak. “Cards forgotten” is also ambiguous: Again events and card lapses are shown directly instead.</p></section><section className="review-rail-card glass"><p className="review-kicker">EVENT CONSISTENCY</p><h2>Background write path</h2><p>A successful grade persists the card first, then queues its analytics event. Statistics can trail the schedule briefly if the worker has not written the event yet.</p></section></aside></div></> : null}</ReviewDataGate></div>;
}
