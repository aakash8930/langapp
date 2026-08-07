import { useState } from 'react';
import { Link } from '@tanstack/react-router';

import { TraceCanvas } from '../TraceCanvas';
import { useKanaData, type KanaCurriculumRow } from '../../hooks/useKanaData';
import { useSession } from '../../useSession';

import './practice.css';

export function KanaWriting({ script }: { script: 'hiragana' | 'katakana' }) {
  const { session } = useSession();
  const { kana, learned, unlearned, isPending, isError, titleGlyph, chartPath, scriptLabel } =
    useKanaData(script);
  const [selected, setSelected] = useState<KanaCurriculumRow | null>(null);
  const [showLearned, setShowLearned] = useState(true);

  const signedIn = session.state === 'signedIn';
  const pool = showLearned && signedIn ? learned : unlearned;
  const toUse = pool.length > 0 ? pool : kana;

  if (isPending) {
    return (
      <div className="page">
        <header className="page-head">
          <h1 className="page-title">
            <span className="ja kana-title-glyph" aria-hidden="true">{titleGlyph}</span>{' '}
            {scriptLabel} Writing
          </h1>
        </header>
        <p className="card-note">Loading characters…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="page">
        <header className="page-head">
          <h1 className="page-title">
            <span className="ja kana-title-glyph" aria-hidden="true">{titleGlyph}</span>{' '}
            {scriptLabel} Writing
          </h1>
        </header>
        <p className="note note-error">
          <strong>Could not load characters.</strong>
          <span>The API may be asleep. Nothing is wrong with your progress.</span>
        </p>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">
          <span className="ja kana-title-glyph" aria-hidden="true">{titleGlyph}</span>{' '}
          {scriptLabel} Writing
        </h1>
        <p className="page-sub">
          Trace each character stroke by stroke. Draw the highlighted stroke in the right direction.
        </p>
      </header>

      {signedIn && (
        <div className="practice-toggle-bar">
          <button
            type="button"
            className={`btn btn-sm ${showLearned ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setShowLearned(true); setSelected(null); }}
          >
            Learned ({learned.length})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${!showLearned ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setShowLearned(false); setSelected(null); }}
          >
            All ({kana.length})
          </button>
        </div>
      )}

      <div className="kana-layout">
        <div className="kana-chart">
          <ul className="kana-cells" style={{ gap: 'var(--s-sm)' }}>
            {toUse.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  className={[
                    'kana-cell',
                    selected?.id === entry.id ? 'kana-cell-selected' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => setSelected(entry)}
                  aria-pressed={selected?.id === entry.id}
                >
                  <span className="kana-cell-glyph ja" lang="ja">{entry.kana}</span>
                  <span className="kana-cell-romaji">{entry.romaji}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <aside className="kana-detail glass" aria-live="polite">
          {selected ? (
            <>
              <p className="kana-detail-glyph ja" lang="ja">{selected.kana}</p>
              <p className="kana-detail-romaji">{selected.romaji}</p>
              <TraceCanvas char={selected.kana} />
            </>
          ) : (
            <p className="card-note">
              Pick a character to trace it. Draw the highlighted stroke — wrong order or direction resets.
            </p>
          )}
        </aside>
      </div>

      <p className="card-note" style={{ marginTop: 'var(--s-lg)' }}>
        <Link className="link-button" to={chartPath}>← Back to the chart</Link>
      </p>
    </div>
  );
}
