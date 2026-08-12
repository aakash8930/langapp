import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import { Icon } from '../ui/Icon';
import { useCorpus, type GrammarItem, type VocabItem } from '../library/useCorpus';
import { buildReadingEntries, readingKindLabel } from './readingData';
import { ReadingTabs } from './ReadingTabs';
import { useReadingStats } from './useReadingStats';

import './reading.css';

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds % 3600 / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function ReadingStatistics() {
  const corpus = useCorpus();
  const { stats, summary, reset } = useReadingStats();
  const [resetArmed, setResetArmed] = useState(false);
  const corpusItems = corpus.data?.items;
  const vocab = useMemo(() => corpusItems?.filter((item): item is VocabItem => item.kind === 'vocab') ?? [], [corpusItems]);
  const grammar = useMemo(() => corpusItems?.filter((item): item is GrammarItem => item.kind === 'grammar') ?? [], [corpusItems]);
  const entries = useMemo(() => buildReadingEntries(vocab, grammar), [grammar, vocab]);
  const byId = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);
  const daily = useMemo(() => {
    return Array.from({ length: 7 }, (_, offset) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - offset));
      const key = dateKey(date);
      const completions = stats.completions.filter((completion) => completion.localDate === key);
      return { key, label: date.toLocaleDateString(undefined, { weekday: 'short' }), characters: completions.reduce((sum, completion) => sum + completion.characters, 0), count: completions.length };
    });
  }, [stats.completions]);
  const maxDaily = Math.max(1, ...daily.map((day) => day.characters));
  const jlpt = ['N5', 'N4', 'N3', 'N2', 'N1', '—'].map((level) => ({ level, count: stats.completions.filter((completion) => completion.jlpt === level).length })).filter((row) => row.count > 0);
  const maxJlpt = Math.max(1, ...jlpt.map((row) => row.count));
  const recent = [...stats.completions].sort((left, right) => right.completedAt - left.completedAt).slice(0, 5);
  const hasActivity = stats.openedIds.length > 0 || stats.activeSeconds > 0 || stats.lookupEvents.length > 0 || stats.quizAnswered > 0 || stats.completions.length > 0;

  function handleReset() {
    if (!resetArmed) {
      setResetArmed(true);
      return;
    }
    reset();
    setResetArmed(false);
  }

  return <div className="page reading-reference"><ReadingTabs active="statistics" /><header className="reading-page-header"><div><p className="reading-kicker">OBSERVED IN THIS BROWSER</p><h1>Reading Statistics</h1><p>Activity recorded while you use the interactive reader—no estimated history, synthetic scores, or server-wide claims.</p></div>{hasActivity ? <button type="button" className={`reading-reset ${resetArmed ? 'is-armed' : ''}`} onClick={handleReset} onBlur={() => setResetArmed(false)}><Icon name="trash" size={15} /> {resetArmed ? 'Press again to erase' : 'Reset local activity'}</button> : null}</header>{corpus.isError ? <div className="reading-inline-notice is-warning" role="status"><Icon name="wifi-off" size={16} /><p>Local totals are still available, but current passage labels could not be loaded from the course corpus.</p></div> : corpus.data?.failedUnits.length ? <div className="reading-inline-notice is-warning" role="status"><Icon name="info" size={16} /><p>Some course units are unavailable. Local totals are complete, but some recent passage labels may be missing.</p></div> : null}<section className="reading-stat-grid"><article className="reading-stat-card glass"><div className="reading-stat-icon"><Icon name="book-open" size={20} /></div><span>Completed entries</span><strong className="tabular">{stats.completions.length}</strong><small>{stats.openedIds.length} unique entries opened</small></article><article className="reading-stat-card glass"><div className="reading-stat-icon"><Icon name="languages" size={20} /></div><span>Japanese characters read</span><strong className="tabular">{summary.charactersRead.toLocaleString()}</strong><small>Counted on explicit completion</small></article><article className="reading-stat-card glass"><div className="reading-stat-icon"><Icon name="search" size={20} /></div><span>Dictionary lookups</span><strong className="tabular">{summary.lookupCount}</strong><small>{summary.uniqueWordsLookedUp} unique course words</small></article><article className="reading-stat-card glass"><div className="reading-stat-icon"><Icon name="flame" size={20} /></div><span>Completion streak</span><strong className="tabular">{summary.streak} day{summary.streak === 1 ? '' : 's'}</strong><small>Today or most recent yesterday</small></article></section>{!hasActivity ? <section className="reading-empty glass"><Icon name="trending-up" size={42} /><h2>Your reading activity starts at zero</h2><p>Open a corpus entry, use dictionary lookup, submit a check, or mark an entry as read. Only those observable actions create statistics.</p><Link className="btn btn-primary" to="/reading-library">Start reading</Link></section> : <><section className="reading-stats-layout"><article className="reading-chart-card glass"><div className="reading-section-head"><div><p className="reading-kicker">LAST 7 LOCAL DAYS</p><h2>Characters completed</h2></div><strong>{summary.charactersRead.toLocaleString()} total</strong></div><div className="reading-bar-chart" role="img" aria-label={daily.map((day) => `${day.label}: ${day.characters} characters`).join(', ')}>{daily.map((day) => <div key={day.key}><div className="reading-bar-track"><span style={{ height: `${day.characters === 0 ? 0 : Math.max(8, day.characters / maxDaily * 100)}%` }}><b>{day.characters > 0 ? day.characters : ''}</b></span></div><small>{day.label}</small></div>)}</div></article><article className="reading-metric-list glass"><p className="reading-kicker">OBSERVED PERFORMANCE</p><h2>Reading signals</h2><dl><div><dt>Active reader time</dt><dd>{formatDuration(stats.activeSeconds)}</dd></div><div><dt>Timed reading speed</dt><dd>{summary.charactersPerMinute === null ? 'Not enough data' : `${summary.charactersPerMinute} char/min`}</dd></div><div><dt>Words encountered on completion</dt><dd>{summary.uniqueWordsEncountered}</dd></div><div><dt>Translation-check accuracy</dt><dd>{summary.quizAccuracy === null ? 'No answers yet' : `${summary.quizAccuracy}% (${stats.quizCorrect}/${stats.quizAnswered})`}</dd></div></dl><p>Speed uses completions with at least five seconds in the reader. It is a character pace, not a fluency rating.</p></article></section><section className="reading-stats-layout"><article className="reading-chart-card glass"><div className="reading-section-head"><div><p className="reading-kicker">COMPLETED CORPUS</p><h2>Entries by JLPT label</h2></div></div>{jlpt.length > 0 ? <div className="reading-horizontal-bars">{jlpt.map((row) => <div key={row.level}><span>{row.level}</span><div><i style={{ width: `${row.count / maxJlpt * 100}%` }} /></div><strong>{row.count}</strong></div>)}</div> : <p className="reading-chart-empty">No completed entries have a JLPT label yet.</p>}</article><article className="reading-recent-card glass"><div className="reading-section-head"><div><p className="reading-kicker">RECENTLY COMPLETED</p><h2>Reading log</h2></div></div>{recent.length > 0 ? <ol>{recent.map((completion) => { const entry = byId.get(completion.id); return <li key={`${completion.id}-${completion.completedAt}`}><div><strong className="ja" lang="ja">{entry?.sentence ?? completion.id}</strong><span>{entry ? readingKindLabel(entry.kind) : 'Corpus entry'} · {completion.characters} chars</span></div><time dateTime={new Date(completion.completedAt).toISOString()}>{new Date(completion.completedAt).toLocaleDateString()}</time>{entry ? <Link to="/reading/$id" params={{ id: entry.id }} aria-label={`Read ${entry.sentence} again`}><Icon name="chevron-right" size={14} /></Link> : null}</li>; })}</ol> : <p className="reading-chart-empty">No explicit completions yet.</p>}</article></section></>}<section className="reading-system-note glass"><Icon name="shield-check" size={19} /><div><h2>Local, observable, and limited</h2><p>Opened entries, active reader time, completion clicks, course-word lookups, encountered matched words, and submitted translation checks are stored locally. This is not synced account progress.</p></div><Link className="btn btn-secondary btn-sm" to="/progress">Account progress</Link></section></div>;
}
