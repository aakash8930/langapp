import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useMemo } from 'react';

import { fetchReadableVocab } from '../api';
import { queryKeys } from '../queryKeys';
import { useSession } from '../useSession';
import { useBookmarks } from '../hooks/useBookmarks';

interface Stats {
  wordsViewed: number;
  sessionStart: number;
}

function loadStats(): Stats {
  try {
    const raw = localStorage.getItem('reading_stats');
    if (raw) return JSON.parse(raw);
  } catch {}
  return { wordsViewed: 0, sessionStart: Date.now() };
}

function saveStats(stats: Stats) {
  localStorage.setItem('reading_stats', JSON.stringify(stats));
}

export const Route = createFileRoute('/read')({
  component: ReadingPage,
});

function ReadingPage() {
  const { session } = useSession();
  const { bookmarks, toggle: toggleBookmark, isBookmarked } = useBookmarks();
  const feed = useQuery({
    queryKey: queryKeys.reading.feed,
    queryFn: () => fetchReadableVocab(120),
    enabled: session.state === 'signedIn',
  });

  const [jlptFilter, setJlptFilter] = useState<string>('all');
  const [showBookmarked, setShowBookmarked] = useState(false);
  const [stats] = useState<Stats>(() => loadStats());
  const [viewingId, setViewingId] = useState<string | null>(null);

  useEffect(() => {
    saveStats(stats);
  }, [stats]);

  useEffect(() => {
    stats.wordsViewed++;
    saveStats(stats);
  }, [feed.data]);

  const filtered = useMemo(() => {
    if (!feed.data) return [];
    let result = feed.data;
    if (jlptFilter !== 'all') result = result.filter((w) => w.jlpt === jlptFilter);
    if (showBookmarked) {
      const bmIds = new Set(bookmarks.map((b) => b.id));
      result = result.filter((w) => bmIds.has(w.id));
    }
    return result;
  }, [feed.data, jlptFilter, showBookmarked, bookmarks]);

  if (session.state === 'loading') {
    return <main className="reader-page wrap"><p className="note">Loading your reading shelf…</p></main>;
  }

  if (session.state === 'signedOut') {
    return (
      <main className="reader-page wrap">
        <section className="reader-card glass">
          <p className="section-idx">Reading</p>
          <h1>Your characters, in context.</h1>
          <p className="reader-copy">Sign in, complete a kana lesson, then come back to read words built only from characters you have been taught.</p>
          <Link className="btn btn-primary" to="/" hash="start">Sign in to start</Link>
        </section>
      </main>
    );
  }

  const knownCount = session.user.learningState.knownKana.length;
  const jlptLevels = [...new Set((feed.data ?? []).map((w) => w.jlpt))].sort();

  return (
    <div className="page">
      <header className="page-head">
        <p className="section-idx">Reading</p>
        <h1 className="page-title">Read what you've learned.</h1>
        <p className="page-sub">Every word here uses only characters you know.</p>
      </header>

      <div className="vocab-toolbar">
        <div className="reader-known" aria-label={`${knownCount} known characters`} style={{ display: 'inline-flex', gap: 'var(--s-xs)', alignItems: 'baseline', padding: 'var(--s-sm) var(--s-md)', background: 'color-mix(in srgb, var(--brand-primary) 10%, transparent)', borderRadius: 'var(--radius-md)' }}>
          <strong style={{ fontSize: 'var(--text-large)', color: 'var(--brand-primary)' }}>{knownCount}</strong>
          <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-caption)' }}>characters known</span>
        </div>

        <select className="vocab-list-select" value={jlptFilter} onChange={(e) => setJlptFilter(e.target.value)}>
          <option value="all">All JLPT</option>
          {jlptLevels.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>

        <button
          className={`btn btn-sm ${showBookmarked ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setShowBookmarked(!showBookmarked)}
        >
          {showBookmarked ? '★ Bookmarked' : '☆ Bookmarks'} ({bookmarks.length})
        </button>

        <span style={{ marginLeft: 'auto', color: 'var(--ink-soft)', fontSize: 'var(--text-caption)' }}>
          {filtered.length} words · {stats.wordsViewed} viewed
        </span>
      </div>

      {feed.isPending ? <p className="note">Finding words you can decode…</p> : null}
      {feed.isError ? (
        <section className="reader-card glass">
          <h2>Your reading shelf is unavailable.</h2>
          <p className="reader-copy">Please check your connection and try again.</p>
          <button className="btn btn-secondary" type="button" onClick={() => void feed.refetch()}>Try again</button>
        </section>
      ) : null}
      {!feed.isPending && !feed.isError && feed.data?.length === 0 ? (
        <section className="reader-card glass">
          <p className="reader-empty-mark ja" aria-hidden="true">あ</p>
          <h2>Your shelf opens after your first kana lesson.</h2>
          <p className="reader-copy">Finish a lesson to add its characters to your known set.</p>
          <Link className="btn btn-primary" to="/">Go to lessons</Link>
        </section>
      ) : null}

      {feed.data && feed.data.length > 0 ? (
        <div className="kana-layout" style={{ marginTop: 'var(--s-lg)' }}>
          <div className="reading-list">
            {filtered.map((word) => {
              const bm = isBookmarked(word.id);
              return (
              <details className="reading-word glass" key={word.id} open={viewingId === word.id}>
                <summary className="vocab-detail-summary" onClick={() => setViewingId(viewingId === word.id ? null : word.id)}>
                  <p className="reading-lemma ja" lang="ja">{word.lemma}</p>
                  <p className="reading-romaji">{word.romaji ?? word.reading}</p>
                  <p className="reading-gloss">{word.gloss}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-sm)', marginLeft: 'auto' }}>
                    <span className="vocab-tag vocab-tag-jlpt">{word.jlpt}</span>
                    <button
                      type="button"
                      className="vocab-bookmark-btn"
                      style={{ color: bm ? '#f59e0b' : undefined }}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleBookmark(word.id, word.lemma, word.reading, word.gloss); }}
                    >
                      {bm ? '★' : '☆'}
                    </button>
                  </div>
                </summary>
                <div style={{ padding: 'var(--s-md) var(--s-lg)', borderTop: '1px solid var(--hairline)' }}>
                  <p style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-caption)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 var(--s-sm)' }}>
                    Constituent kana
                  </p>
                  <div className="vocab-related-tags">
                    {(word.constituentKana ?? []).map((k) => (
                      <span key={k} className="kana-cell" style={{ width: '40px', height: '40px', fontSize: '1rem', cursor: 'default' }}>
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              </details>
            );
            })}
          </div>

          <aside className="kana-detail glass" style={{ position: 'sticky', top: '80px', alignSelf: 'start' }}>
            <h3 style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-caption)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 var(--s-md)' }}>Reading Stats</h3>
            <dl className="kana-detail-facts">
              <div>
                <dt>Words on shelf</dt>
                <dd className="tabular">{feed.data?.length ?? 0}</dd>
              </div>
              <div>
                <dt>Known kana</dt>
                <dd className="tabular">{knownCount}</dd>
              </div>
              {jlptLevels.map((l) => (
                <div key={l}>
                  <dt>{l} words</dt>
                  <dd className="tabular">{feed.data?.filter((w) => w.jlpt === l).length ?? 0}</dd>
                </div>
              ))}
              <div>
                <dt>Shelf viewed</dt>
                <dd className="tabular">{stats.wordsViewed} times</dd>
              </div>
            </dl>
            <Link className="btn btn-sm btn-secondary" to="/vocab-bookmarks" style={{ marginTop: 'var(--s-md)', width: '100%', textAlign: 'center' }}>
              Bookmarked words
            </Link>
            <Link className="btn btn-sm btn-secondary" to="/dictionary" style={{ marginTop: 'var(--s-sm)', width: '100%', textAlign: 'center' }}>
              Dictionary
            </Link>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
