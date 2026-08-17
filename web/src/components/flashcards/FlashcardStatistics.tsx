import { Link } from '@tanstack/react-router';
import { useMemo } from 'react';

import { Icon } from '../ui/Icon';
import { FlashcardTabs } from './FlashcardTabs';
import { useFlashcardDecks, type FlashcardStudySession } from './useFlashcardDecks';
import './flashcards.css';

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function localDays(sessions: FlashcardStudySession[], days = 14) {
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'narrow' });
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (days - 1 - index));
    const next = new Date(date); next.setDate(next.getDate() + 1);
    const matching = sessions.filter((entry) => entry.completedAt >= date.getTime() && entry.completedAt < next.getTime());
    return { key: date.toISOString(), label: weekday.format(date), studied: matching.reduce((sum, entry) => sum + entry.studied, 0) };
  });
}

export function FlashcardStatistics() {
  const local = useFlashcardDecks();
  const days = useMemo(() => localDays(local.sessions), [local.sessions]);
  const maxCards = Math.max(1, ...days.map((day) => day.studied));

  return (
    <div className="page flashcard-reference">
      <FlashcardTabs active="statistics" />
      <header className="flashcard-page-header">
        <div><p className="flashcard-kicker">THIS BROWSER ONLY</p><h1>Flashcard Statistics</h1><p>Observed results from self-directed deck sessions. No scheduling or estimated mastery.</p></div>
        {local.sessions.length > 0 ? <button type="button" className="btn btn-secondary" onClick={() => { if (window.confirm('Clear local flashcard session history? Your decks will remain.')) local.clearActivity(); }}><Icon name="trash" size={15} /> Clear history</button> : null}
      </header>
      <section className="flashcard-stat-band">
        <article className="glass"><span>Sessions</span><strong>{local.summary.sessions}</strong></article>
        <article className="glass"><span>Cards studied</span><strong>{local.summary.studied}</strong></article>
        <article className="glass"><span>Self-recalled</span><strong>{local.summary.accuracy === null ? '—' : `${local.summary.accuracy}%`}</strong></article>
        <article className="glass"><span>Active time</span><strong>{formatDuration(local.summary.seconds)}</strong></article>
      </section>
      {local.sessions.length === 0 ? (
        <section className="flashcard-empty glass"><Icon name="trending-up" size={42} /><h2>No study observations yet</h2><p>Complete a deck session to see local activity.</p><Link className="btn btn-primary" to="/flashcards">Choose a deck</Link></section>
      ) : (
        <section className="flashcard-chart-card glass"><h2>Cards studied · last 14 days</h2><div className="flashcard-bars">{days.map((day) => <div key={day.key}><span>{day.studied || ''}</span><i style={{ height: `${day.studied === 0 ? 2 : Math.max(8, day.studied / maxCards * 100)}%` }} /><small>{day.label}</small></div>)}</div></section>
      )}
      <p className="card-note">Decks and their activity remain local to this browser.</p>
    </div>
  );
}
