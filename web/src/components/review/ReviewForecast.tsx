import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import { fetchDailyReviewForecast } from '../../api';
import { queryKeys } from '../../queryKeys';
import { useSession } from '../../useSession';
import { ReviewDataGate } from './reviewHelpers';
import { ReviewTabs } from './ReviewTabs';

import './review.css';

export function ReviewForecast() {
  const { session } = useSession();
  const [days, setDays] = useState(14);
  const enabled = session.state === 'signedIn';
  const forecast = useQuery({ queryKey: queryKeys.reviews.forecast(days), queryFn: () => fetchDailyReviewForecast(days), enabled });
  const maximum = Math.max(1, ...(forecast.data?.map((entry) => entry.due) ?? [0]));
  const total = forecast.data?.reduce((sum, entry) => sum + entry.due, 0) ?? 0;
  const peak = forecast.data?.reduce((current, entry) => entry.due > current.due ? entry : current, forecast.data[0] ?? { date: '', due: 0, isToday: false });
  return <div className="page review-reference"><ReviewTabs active="forecast" /><header className="review-page-header"><div><p className="review-kicker">CURRENT NEXT-DUE SCHEDULE</p><h1>Review Forecast</h1><p>See when each card&rsquo;s currently stored next due date lands. This is a schedule snapshot, not a simulation of reviews that may create additional intervals.</p></div><label className="review-limit-select"><span>Horizon</span><select value={days} onChange={(event) => setDays(Number(event.target.value))}><option value={7}>7 days</option><option value={14}>14 days</option><option value={31}>31 days</option></select></label></header><ReviewDataGate session={session} pending={forecast.isPending && enabled} error={forecast.isError} onRetry={() => void forecast.refetch()}>{forecast.data ? <><section className="review-stat-band"><article className="glass"><span>Due in view</span><strong className="tabular">{total}</strong><small>Current next-due records</small></article><article className="glass"><span>Due today</span><strong className="tabular">{forecast.data[0]?.due ?? 0}</strong><small>Includes earlier overdue cards</small></article><article className="glass"><span>Peak scheduled day</span><strong className="tabular">{peak?.due ?? 0}</strong><small>{peak?.date ? new Date(`${peak.date}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'No scheduled cards'}</small></article></section><div className="review-forecast-layout"><main className="review-forecast-card glass"><div className="review-section-head"><div><p className="review-kicker">ACCOUNT TIMEZONE · {days} DAYS</p><h2>Upcoming workload</h2></div><span>Next due date per card</span></div><div className="review-forecast-bars" role="img" aria-label={`${total} currently scheduled card due dates across the next ${days} days`}>{forecast.data.map((entry) => <article key={entry.date}><span className="tabular">{entry.due || ''}</span><div><i style={{ height: `${entry.due === 0 ? 2 : Math.max(8, entry.due / maximum * 100)}%` }} /></div><strong>{entry.isToday ? 'Today' : new Date(`${entry.date}T12:00:00`).toLocaleDateString([], { weekday: 'narrow' })}</strong><small>{new Date(`${entry.date}T12:00:00`).toLocaleDateString([], { month: 'numeric', day: 'numeric' })}</small></article>)}</div></main><aside className="review-side-stack"><section className="review-rail-card glass"><p className="review-kicker">TODAY&rsquo;S WORKLOAD</p><h2>{forecast.data[0]?.due ?? 0} ready now</h2><p>Earlier overdue cards are rolled into today because they are already available to review.</p>{(forecast.data[0]?.due ?? 0) > 0 ? <Link className="btn btn-primary" to="/review-session">Start Review</Link> : null}</section><section className="review-rail-card glass"><p className="review-kicker">FORECAST BOUNDARY</p><h2>No recursive simulation</h2><p>Completing a card today creates a new server interval that can land inside this horizon. The chart updates after grading rather than guessing that future decision.</p></section><section className="review-rail-card glass"><p className="review-kicker">NEW-CARD INTAKE</p><h2>Server-capped daily set</h2><p>The existing session service admits at most five genuinely new cards after due reviews. There is no user-adjustable intake setting to pretend is editable here.</p></section></aside></div></> : null}</ReviewDataGate></div>;
}
