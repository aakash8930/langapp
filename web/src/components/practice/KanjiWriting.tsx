import { useState } from 'react';
import { Link } from '@tanstack/react-router';

import { useCorpus, type KanjiItem } from '../library/useCorpus';
import { TraceCanvas } from '../TraceCanvas';

import '../library/vocab-browse.css';
import './practice.css';

export function KanjiWritingPage() {
  const corpus = useCorpus();
  const items: KanjiItem[] = corpus.data
    ? (corpus.data.items.filter((i): i is KanjiItem => i.kind === 'kanji') as KanjiItem[])
    : [];
  const [selected, setSelected] = useState<KanjiItem | null>(null);
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? items.filter((i) => `${i.char} ${i.meanings.join(' ')} ${i.on.join(' ')} ${i.kun.join(' ')}`.toLowerCase().includes(query.toLowerCase()))
    : items;

  if (corpus.isPending) {
    return <div className="page"><header className="page-head"><h1 className="page-title"><span className="ja library-title-glyph" aria-hidden="true">漢</span> Kanji Writing</h1></header><p className="card-note">Loading…</p></div>;
  }

  if (corpus.isError) {
    return <div className="page"><header className="page-head"><h1 className="page-title"><span className="ja library-title-glyph" aria-hidden="true">漢</span> Kanji Writing</h1></header><p className="note note-error"><strong>Could not load kanji.</strong></p></div>;
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">
          <span className="ja library-title-glyph" aria-hidden="true">漢</span> Kanji Writing
        </h1>
        <p className="page-sub">Pick a kanji and trace it stroke by stroke.</p>
      </header>

      <div className="library-search" style={{ marginBottom: 'var(--s-lg)' }}>
        <span style={{ fontSize: 'var(--text-small)' }}>🔍</span>
        <input
          className="library-search-input"
          type="search"
          placeholder="Search by character, meaning or reading…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="kana-layout">
        <div style={{ overflow: 'auto', maxHeight: '70vh' }}>
          <ul className="kanji-grid">
            {filtered.slice(0, 120).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`kanji-card ${selected?.id === item.id ? 'kanji-card-selected' : ''}`}
                  onClick={() => setSelected(item)}
                  style={{
                    borderColor: selected?.id === item.id ? 'var(--brand-primary)' : undefined,
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                    background: selected?.id === item.id ? 'color-mix(in srgb, var(--brand-primary) 8%, var(--surface))' : 'var(--surface)',
                  }}
                >
                  <div className="kanji-summary">
                    <span className="kanji-char ja" lang="ja">{item.char}</span>
                    <span className="kanji-meaning">{item.meanings[0] ?? '—'}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <aside className="kana-detail glass" aria-live="polite">
          {selected ? (
            <>
              <p className="kana-detail-glyph ja" lang="ja">{selected.char}</p>
              <p className="kana-detail-romaji">{selected.meanings.join(', ')}</p>
              <TraceCanvas char={selected.char} />
            </>
          ) : (
            <p className="card-note">Pick a character to trace it.</p>
          )}
        </aside>
      </div>

      <p className="card-note" style={{ marginTop: 'var(--s-lg)' }}>
        <Link className="link-button" to="/kanji">← Back to kanji list</Link>
      </p>
    </div>
  );
}
