import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';

import { useBookmarks } from '../hooks/useBookmarks';
import { exportAsJson, exportAsCsv } from '../components/library/exportVocab';
import { vocabRouteStyles } from '../styles/vocabRouteStyles';

export const Route = createFileRoute('/vocab-bookmarks')({
  component: BookmarkRoute,
});

function BookmarkRoute() {
  void vocabRouteStyles;
  const { bookmarks, remove } = useBookmarks();
  const [exportText, setExportText] = useState('');

  if (bookmarks.length === 0) {
    return (
      <div className="page">
        <header className="page-head">
          <h1 className="page-title">
            <span className="ja library-title-glyph" aria-hidden="true">★</span>{' '}
            Bookmarked Words
          </h1>
        </header>
        <div className="glass panel quiz-summary">
          <h2>No bookmarks yet</h2>
          <p className="summary-note">
            Click the ☆ next to any word in the vocabulary list to save it here.
          </p>
          <Link className="btn btn-primary" to="/vocabulary" style={{ marginTop: 'var(--s-md)' }}>
            Browse vocabulary
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">
          <span className="ja library-title-glyph" aria-hidden="true">★</span>{' '}
          Bookmarked Words
        </h1>
        <p className="page-sub">
          {bookmarks.length} word{bookmarks.length === 1 ? '' : 's'} saved.
        </p>
      </header>

      <div style={{ display: 'flex', gap: 'var(--s-md)', marginBottom: 'var(--s-lg)', flexWrap: 'wrap' }}>
        <Link className="btn btn-sm btn-secondary" to="/vocabulary">
          ← Browse vocabulary
        </Link>
        <button className="btn btn-sm btn-primary" onClick={() => setExportText(exportAsJson(bookmarks))}>
          Export JSON
        </button>
        <button className="btn btn-sm btn-secondary" onClick={() => setExportText(exportAsCsv(bookmarks))}>
          Export CSV
        </button>
      </div>

      {exportText && (
        <div className="export-area">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--s-md)' }}>
            <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-small)' }}>
              Copy the content below and paste into a file.
            </span>
            <button
              className="btn btn-sm btn-secondary"
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(exportText);
              }}
            >
              Copy
            </button>
          </div>
          <pre>{exportText}</pre>
        </div>
      )}

      <ul className="bookmark-list">
        {bookmarks.map((b) => (
          <li key={b.id} className="bookmark-row">
            <span className="bookmark-lemma ja" lang="ja">{b.lemma}</span>
            <span className="bookmark-gloss">{b.gloss}</span>
            {b.reading !== b.lemma && (
              <span className="vocab-reading ja" lang="ja" style={{ color: 'var(--ink-soft)' }}>
                {b.reading}
              </span>
            )}
            <button
              type="button"
              className="vocab-bookmark-btn vocab-bookmarked"
              onClick={() => remove(b.id)}
              title="Remove bookmark"
            >
              ★
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
