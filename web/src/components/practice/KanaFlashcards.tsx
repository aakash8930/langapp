import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';

import { useKanaData } from '../../hooks/useKanaData';
import { useSession } from '../../useSession';
import { SpeakButton } from '../SpeakButton';

import './practice.css';

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function KanaFlashcards({ script }: { script: 'hiragana' | 'katakana' }) {
  const { learned, kana, isPending, isError, chartPath, scriptLabel } = useKanaData(script);
  const { session } = useSession();

  const [pool, setPool] = useState<'all' | 'learned'>('all');
  const items = pool === 'learned' && learned.length > 0 ? learned : kana;
  const shuffled = useMemo(() => shuffle(items), [items]);

  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [sessionOver, setSessionOver] = useState(false);
  const [results, setResults] = useState<{ kana: string; recalled: boolean }[]>([]);

  const current = shuffled[index];

  const grade = (recalled: boolean) => {
    setResults((r) => [...r, { kana: current.kana, recalled }]);
    if (index >= shuffled.length - 1) {
      setSessionOver(true);
      return;
    }
    setIndex((n) => n + 1);
    setRevealed(false);
  };

  if (isPending) {
    return (
      <div className="page">
        <header className="page-head">
          <h1 className="page-title">{scriptLabel} Flashcards</h1>
        </header>
        <p className="card-note">Loading characters…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="page">
        <header className="page-head">
          <h1 className="page-title">{scriptLabel} Flashcards</h1>
        </header>
        <p className="note note-error">
          <strong>Could not load characters.</strong>
        </p>
      </div>
    );
  }

  if (sessionOver) {
    const recalled = results.filter((r) => r.recalled).length;
    const missed = results.filter((r) => !r.recalled);

    return (
      <div className="glass panel quiz-summary">
        <h2>Flashcards complete</h2>
        <dl className="summary-rows">
          <div>
            <dt>Recalled</dt>
            <dd className="tabular">
              {recalled} of {results.length}
            </dd>
          </div>
          <div>
            <dt>Accuracy</dt>
            <dd className="tabular">
              {results.length > 0 ? Math.round((recalled / results.length) * 100) : 0}%
            </dd>
          </div>
        </dl>
        {missed.length > 0 && (
          <div className="missed-list">
            <h3>Needs more practice</h3>
            <ul className="kana-cells" style={{ justifyContent: 'center', marginTop: 'var(--s-md)' }}>
              {missed.map((m) => (
                <li key={m.kana}>
                  <div className="kana-cell kana-cell-missed">
                    <span className="kana-cell-glyph ja" lang="ja">{m.kana}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div style={{ display: 'flex', gap: 'var(--s-md)', marginTop: 'var(--s-lg)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="btn btn-primary" type="button" onClick={() => {
            setIndex(0);
            setSessionOver(false);
            setRevealed(false);
            setResults([]);
          }}>
            Start again
          </button>
          <Link className="btn btn-secondary" to={chartPath}>
            Back to chart
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">{scriptLabel} Flashcards</h1>
        <p className="page-sub">
          Recall the reading, then flip to check.
        </p>
      </header>

      <div className="practice-controls">
        {session.state === 'signedIn' && (
          <div className="practice-toggle-bar">
            <button
              type="button"
              className={`btn btn-sm ${pool === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setPool('all'); }}
            >
              All ({kana.length})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${pool === 'learned' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setPool('learned'); }}
            >
              Learned ({learned.length})
            </button>
          </div>
        )}

        <div className="practice-progress">
          <span className="practice-count tabular">{index + 1} / {shuffled.length}</span>
        </div>
      </div>

      <div className="glass panel quiz-card" style={{ maxWidth: '420px', margin: '0 auto', overflow: 'visible' }}>
        <div className="flip-container">
          <div className={`flip-card ${revealed ? 'revealed' : ''}`}>
            <div className="flip-front">
              <p className="quiz-prompt ja quiz-prompt-kana">{current.kana}</p>
              <SpeakButton kanaId={current.id} text={current.kana} label="Hear it" />
            </div>
            <div className="flip-back">
              <p className="card-back-answer">{current.romaji}</p>
              {current.row ? (
                <p className="card-back-detail">{current.row} row</p>
              ) : null}
            </div>
          </div>
        </div>

        {!revealed ? (
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => setRevealed(true)}
            style={{ position: 'absolute', bottom: '-24px', left: '50%', transform: 'translateX(-50%)' }}
          >
            Show answer
          </button>
        ) : (
          <div className="grades" aria-label="Did you recall it?" style={{ marginTop: '32px' }}>
            <button
              type="button"
              className="grade grade-again"
              onClick={() => grade(false)}
            >
              No
            </button>
            <button
              type="button"
              className="grade grade-easy"
              onClick={() => grade(true)}
            >
              Yes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
