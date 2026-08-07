import { createFileRoute, Link } from '@tanstack/react-router';

import { useKanjiBookmarks } from '../hooks/useKanjiBookmarks';

export const Route = createFileRoute('/kanji-bookmarks')({
  component: KanjiBookmarkRoute,
});

function KanjiBookmarkRoute() {
  const { bookmarks, remove } = useKanjiBookmarks();

  if (bookmarks.length === 0) {
    return (
      <div className="page">
        <header className="page-head">
          <h1 className="page-title">
            <span className="ja library-title-glyph" aria-hidden="true">★</span> Bookmarked Kanji
          </h1>
        </header>
        <div className="glass panel quiz-summary">
          <h2>No bookmarks yet</h2>
          <p className="summary-note">Click ★ next to any kanji in the list to save it here.</p>
          <Link className="btn btn-primary" to="/kanji" style={{ marginTop: 'var(--s-md)' }}>Browse kanji</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">
          <span className="ja library-title-glyph" aria-hidden="true">★</span> Bookmarked Kanji
        </h1>
        <p className="page-sub">{bookmarks.length} saved.</p>
      </header>

      <ul className="kanji-grid">
        {bookmarks.map((b) => (
          <li key={b.char}>
            <div className="kanji-card" style={{ position: 'relative' }}>
              <div className="kanji-summary">
                <span className="kanji-char ja" lang="ja">{b.char}</span>
                <span className="kanji-meaning">{b.meaning}</span>
              </div>
              <button
                type="button"
                onClick={() => remove(b.char)}
                style={{
                  position: 'absolute',
                  top: 'var(--s-sm)',
                  right: 'var(--s-sm)',
                  background: 'none',
                  border: 'none',
                  color: '#f59e0b',
                  cursor: 'pointer',
                  fontSize: '1.1rem',
                }}
                title="Remove bookmark"
              >
                ★
              </button>
            </div>
          </li>
        ))}
      </ul>

      <p className="card-note" style={{ marginTop: 'var(--s-lg)' }}>
        <Link className="link-button" to="/kanji">← Back to kanji list</Link>
      </p>
    </div>
  );
}
