import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { fetchReviewHeatmap } from '../../api';
import { queryKeys } from '../../queryKeys';
import { useSession } from '../../useSession';
import { Icon } from '../ui/Icon';
import { ReviewDataGate } from './reviewHelpers';
import { ReviewTabs } from './ReviewTabs';

import './review.css';

export function ReviewHeatmap() {
  const { session } = useSession();
  const [days, setDays] = useState(84);
  const enabled = session.state === 'signedIn';
  const heatmap = useQuery({ queryKey: queryKeys.reviews.heatmap(days), queryFn: () => fetchReviewHeatmap(days), enabled });
  const maximum = Math.max(1, ...(heatmap.data?.map((entry) => entry.count) ?? [0]));
  const total = heatmap.data?.reduce((sum, entry) => sum + entry.count, 0) ?? 0;
  const activeDays = heatmap.data?.filter((entry) => entry.count > 0).length ?? 0;
  return <div className="page review-reference"><ReviewTabs active="heatmap" /><header className="review-page-header"><div><p className="review-kicker">SPECIALIZED REVIEW ACTIVITY</p><h1>Review Heatmap</h1><p>This view and Progress read the same persisted review events. This page filters to review grades only rather than storing a second activity history.</p></div><label className="review-limit-select"><span>Range</span><select value={days} onChange={(event) => setDays(Number(event.target.value))}><option value={84}>12 weeks</option><option value={182}>26 weeks</option><option value={365}>1 year</option></select></label></header><ReviewDataGate session={session} pending={heatmap.isPending && enabled} error={heatmap.isError} onRetry={() => void heatmap.refetch()}>{heatmap.data ? <><section className="review-stat-band"><article className="glass"><span>Reviews in range</span><strong className="tabular">{total}</strong><small>Confirmed grade events</small></article><article className="glass"><span>Active review days</span><strong className="tabular">{activeDays}</strong><small>Days with at least one grade</small></article><article className="glass"><span>Peak day</span><strong className="tabular">{maximum === 1 && total === 0 ? 0 : maximum}</strong><small>Reviews on one local day</small></article></section><div className="review-heatmap-layout"><main className="review-heatmap-card glass"><div className="review-section-head"><div><p className="review-kicker">LOCAL CALENDAR DAYS</p><h2>Review activity</h2></div><span>{days} days</span></div>{total === 0 ? <div className="review-empty-inline"><Icon name="grid" size={38} /><h3>No review events in this range</h3><p>Empty cells are real zero-review days, not missing sample data.</p></div> : null}<div className="review-heatmap-scroll"><div className="review-heatmap-grid" style={{ '--review-weeks': Math.ceil(heatmap.data.length / 7) } as React.CSSProperties} role="img" aria-label={`${total} completed reviews across ${activeDays} active days in the selected range`}>{heatmap.data.map((entry) => { const level = entry.count === 0 ? 0 : Math.min(4, Math.ceil(entry.count / maximum * 4)); return <span key={entry.date} className={`is-level-${level}`} title={`${entry.date}: ${entry.count} reviews`} aria-hidden="true" />; })}</div></div><div className="review-heatmap-legend"><span>Fewer</span>{[0, 1, 2, 3, 4].map((level) => <i key={level} className={`is-level-${level}`} />)}<span>More</span></div></main><aside className="review-side-stack"><section className="review-rail-card glass"><p className="review-kicker">DATASET</p><h2>Review grades only</h2><p>Lessons, local Flashcard sessions, Reading, and Writing activity do not color these cells unless they produced an actual Review grade event.</p></section><section className="review-rail-card glass"><p className="review-kicker">TIMEZONE</p><h2>Your account&rsquo;s local dates</h2><p>The server groups events with the same timezone used for daily goals and today&rsquo;s queue.</p></section><section className="review-rail-card glass"><p className="review-kicker">EMPTY DAYS</p><h2>Zero means zero</h2><p>The endpoint emits every calendar date in the range. Missing event rows become explicit zero-count cells.</p></section></aside></div></> : null}</ReviewDataGate></div>;
}
