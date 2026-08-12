import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useMemo } from 'react';

import { fetchAnalytics, fetchMemoryModel, fetchReviewForecast, fetchReviewHistory } from '../../api';
import { queryKeys } from '../../queryKeys';
import { useSession } from '../../useSession';
import { Icon } from '../ui/Icon';
import { FlashcardTabs } from './FlashcardTabs';
import { useFlashcardDecks, type FlashcardStudySession } from './useFlashcardDecks';

import './flashcards.css';

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function localDays(sessions: FlashcardStudySession[], days = 14) {
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'narrow' });
  const dateLabel = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (days - 1 - index));
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    const matching = sessions.filter((session) => session.completedAt >= date.getTime() && session.completedAt < next.getTime());
    return { key: String(date.getTime()), dateLabel: dateLabel.format(date), label: weekday.format(date), studied: matching.reduce((total, session) => total + session.studied, 0), sessions: matching.length };
  });
}

export function FlashcardStatistics() {
  const { session } = useSession();
  const local = useFlashcardDecks();
  const signedIn = session.state === 'signedIn';
  const memory = useQuery({ queryKey: queryKeys.learning.memoryModel, queryFn: fetchMemoryModel, enabled: signedIn });
  const analytics = useQuery({ queryKey: queryKeys.learning.analytics, queryFn: fetchAnalytics, enabled: signedIn });
  const history = useQuery({ queryKey: ['reviews', 'history', 30], queryFn: () => fetchReviewHistory(30), enabled: signedIn });
  const forecast = useQuery({ queryKey: ['reviews', 'forecast'], queryFn: fetchReviewForecast, enabled: signedIn });
  const days = useMemo(() => localDays(local.sessions), [local.sessions]);
  const maxCards = Math.max(1, ...days.map((day) => day.studied));
  const deckRows = useMemo(() => {
    const rows = new Map<string, { id: string; title: string; sessions: number; cards: number; recalled: number; seconds: number; last: number }>();
    local.sessions.forEach((entry) => {
      const row = rows.get(entry.deckId) ?? { id: entry.deckId, title: entry.deckTitle, sessions: 0, cards: 0, recalled: 0, seconds: 0, last: 0 };
      row.sessions += 1;
      row.cards += entry.studied;
      row.recalled += entry.grades.hard + entry.grades.good + entry.grades.easy;
      row.seconds += entry.seconds;
      row.last = Math.max(row.last, entry.completedAt);
      rows.set(entry.deckId, row);
    });
    return [...rows.values()].sort((a, b) => b.last - a.last);
  }, [local.sessions]);

  return <div className="page flashcard-reference"><FlashcardTabs active="statistics" /><header className="flashcard-page-header"><div><p className="flashcard-kicker">OBSERVED RESULTS ONLY</p><h1>Flashcard Statistics</h1><p>Browser-local deck sessions and account-backed Review analytics are shown separately, with no estimated mastery or invented popularity.</p></div>{local.sessions.length > 0 ? <button type="button" className="btn btn-secondary" onClick={() => { if (window.confirm('Clear all local flashcard session history from this browser? Your decks will remain.')) local.clearActivity(); }}><Icon name="trash" size={15} /> Clear local history</button> : null}</header><section className="flashcard-stat-band" aria-label="Local flashcard session totals"><article className="glass"><span>Local sessions</span><strong className="tabular">{local.summary.sessions}</strong><small>Completed runs</small></article><article className="glass"><span>Cards studied</span><strong className="tabular">{local.summary.studied}</strong><small>Includes repeats</small></article><article className="glass"><span>Self-recalled</span><strong className="tabular">{local.summary.accuracy === null ? '—' : `${local.summary.accuracy}%`}</strong><small>Hard + Good + Easy</small></article><article className="glass"><span>Active session time</span><strong className="tabular">{formatDuration(local.summary.seconds)}</strong><small>Visible session time</small></article></section><div className="flashcard-stats-layout"><main>{local.sessions.length === 0 ? <section className="flashcard-empty glass"><Icon name="trending-up" size={42} /><h2>No local study observations yet</h2><p>Complete an unscheduled deck session and its card count, self-ratings, and active time will appear here.</p><Link className="btn btn-primary" to="/flashcards">Choose a deck</Link></section> : <><section className="flashcard-chart-card glass"><div className="flashcard-section-head"><div><p className="flashcard-kicker">THIS BROWSER · LAST 14 DAYS</p><h2>Cards studied per day</h2></div><span>{days.reduce((total, day) => total + day.studied, 0)} cards</span></div><div className="flashcard-bars" role="img" aria-label={`Local cards studied over the last 14 days. Maximum ${maxCards} cards in one day.`}>{days.map((day) => <div key={day.key} title={`${day.dateLabel}: ${day.studied} cards in ${day.sessions} sessions`}><span className="flashcard-bar-value tabular">{day.studied || ''}</span><i style={{ height: `${day.studied === 0 ? 2 : Math.max(8, day.studied / maxCards * 100)}%` }} /><small>{day.label}</small></div>)}</div></section><section className="flashcard-deck-results glass"><div className="flashcard-section-head"><div><p className="flashcard-kicker">OBSERVED BY DECK</p><h2>Local session history</h2></div><span>{deckRows.length} studied decks</span></div><div className="flashcard-result-table"><div className="flashcard-result-row is-head"><span>Deck</span><span>Sessions</span><span>Cards</span><span>Self-recalled</span><span>Time</span></div>{deckRows.map((row) => <div className="flashcard-result-row" key={row.id}><span><strong>{row.title}</strong><small>Last {new Date(row.last).toLocaleDateString()}</small></span><span className="tabular">{row.sessions}</span><span className="tabular">{row.cards}</span><span className="tabular">{row.cards > 0 ? `${Math.round(row.recalled / row.cards * 100)}%` : '—'}</span><span className="tabular">{formatDuration(row.seconds)}</span></div>)}</div></section><section className="flashcard-recent-sessions glass"><div className="flashcard-section-head"><div><p className="flashcard-kicker">RECENT RUNS</p><h2>Completed sessions</h2></div><span>Latest {Math.min(8, local.sessions.length)}</span></div><ol>{local.sessions.slice(0, 8).map((entry) => <li key={entry.id}><time dateTime={new Date(entry.completedAt).toISOString()}>{new Date(entry.completedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</time><span><strong>{entry.deckTitle}</strong><small>{entry.studied} cards · {formatDuration(entry.seconds)}</small></span><span className="tabular">{entry.studied > 0 ? `${Math.round((entry.grades.hard + entry.grades.good + entry.grades.easy) / entry.studied * 100)}%` : '—'}</span></li>)}</ol></section></>}</main><aside className="flashcard-stats-rail"><section className="flashcard-rail-card glass"><p className="flashcard-kicker">LOCAL DATA BOUNDARY</p><h2>Stored in this browser</h2><p>Deck-session statistics do not sync to an account. Clearing site data, changing browsers, or using the clear action removes them.</p></section><AccountStatistics state={session.state} analytics={analytics} memory={memory} history={history} forecast={forecast} /></aside></div></div>;
}

type QueryResult<T> = { data: T | undefined; isPending: boolean; isError: boolean; refetch: () => unknown };

function AccountStatistics({ state, analytics, memory, history, forecast }: { state: 'loading' | 'signedOut' | 'signedIn'; analytics: QueryResult<Awaited<ReturnType<typeof fetchAnalytics>>>; memory: QueryResult<Awaited<ReturnType<typeof fetchMemoryModel>>>; history: QueryResult<Awaited<ReturnType<typeof fetchReviewHistory>>>; forecast: QueryResult<Awaited<ReturnType<typeof fetchReviewForecast>>> }) {
  if (state === 'loading') return <section className="flashcard-rail-card glass" role="status"><p className="flashcard-kicker">ACCOUNT REVIEW</p><h2>Checking your account…</h2></section>;
  if (state === 'signedOut') return <section className="flashcard-rail-card glass"><p className="flashcard-kicker">ACCOUNT REVIEW</p><h2>Scheduled analytics need sign-in</h2><p>Sign in to load actual retention, mastery, review accuracy, and forecast data from the existing Review System.</p><Link className="btn btn-secondary" to="/signin">Sign in</Link></section>;
  const accountError = analytics.isError && memory.isError && history.isError && forecast.isError;
  if (accountError) return <section className="flashcard-rail-card glass"><p className="flashcard-kicker">ACCOUNT REVIEW</p><h2>Analytics unavailable</h2><p>The server did not return review observations. Local flashcard statistics above are unaffected.</p><button type="button" className="btn btn-secondary" onClick={() => { void analytics.refetch(); void memory.refetch(); void history.refetch(); void forecast.refetch(); }}>Try again</button></section>;
  const thirtyDayReviews = history.data?.reduce((total, entry) => total + entry.count, 0);
  const thirtyDayRecalled = history.data?.reduce((total, entry) => total + entry.recalled, 0);
  return <><section className="flashcard-rail-card glass"><p className="flashcard-kicker">ACCOUNT REVIEW · SERVER</p><h2>Today</h2>{analytics.isPending ? <p>Loading actual review analytics…</p> : analytics.isError ? <p>Today&rsquo;s analytics are unavailable.</p> : <dl><div><dt>Reviews</dt><dd>{analytics.data?.totalReviewsToday ?? 0}</dd></div><div><dt>Accuracy</dt><dd>{Math.round((analytics.data?.accuracyRateToday ?? 0) * 100)}%</dd></div><div><dt>Average answer</dt><dd>{analytics.data ? `${(analytics.data.averageResponseTimeMs / 1000).toFixed(1)}s` : '—'}</dd></div></dl>}</section><section className="flashcard-rail-card glass"><p className="flashcard-kicker">ACCOUNT MEMORY · SERVER</p><h2>Scheduled cards</h2>{memory.isPending ? <p>Loading memory model…</p> : memory.isError ? <p>Memory data are unavailable.</p> : <dl><div><dt>Total cards</dt><dd>{memory.data?.totalCards ?? 0}</dd></div><div><dt>Retention</dt><dd>{memory.data ? `${Math.round(memory.data.overallRetentionRate)}%` : '—'}</dd></div><div><dt>Mastered</dt><dd>{memory.data?.masteryBreakdown.mastered ?? 0}</dd></div></dl>}</section><section className="flashcard-rail-card glass"><p className="flashcard-kicker">LAST 30 DAYS · SERVER</p><h2>Review history</h2>{history.isPending ? <p>Loading observed reviews…</p> : history.isError ? <p>Review history is unavailable.</p> : <dl><div><dt>Reviews</dt><dd>{thirtyDayReviews ?? 0}</dd></div><div><dt>Recalled</dt><dd>{thirtyDayRecalled ?? 0}</dd></div><div><dt>Observed rate</dt><dd>{thirtyDayReviews ? `${Math.round((thirtyDayRecalled ?? 0) / thirtyDayReviews * 100)}%` : '—'}</dd></div></dl>}</section><section className="flashcard-rail-card glass"><p className="flashcard-kicker">FORECAST · SERVER</p><h2>Existing schedule</h2>{forecast.isPending ? <p>Loading review forecast…</p> : forecast.isError ? <p>Forecast is unavailable.</p> : !forecast.data?.length ? <p>No scheduled cards were returned.</p> : <ol className="flashcard-forecast-list">{forecast.data.map((entry) => <li key={`${entry.days}-${entry.weekLabel}`}><span>{entry.weekLabel}</span><strong className="tabular">{entry.due}</strong></li>)}</ol>}<Link to="/progress">Open full Progress <Icon name="chevron-right" size={13} /></Link></section></>;
}
