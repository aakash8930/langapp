import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';

import { useLocalMistakes } from '../../hooks/useLocalMistakes';
import { useKanaData } from '../../hooks/useKanaData';

import './practice.css';

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function KanaMistakes({ script }: { script: 'hiragana' | 'katakana' }) {
  const { chartPath, scriptLabel } = useKanaData(script);
  const { mistakes, remove: removeMistake, clear: clearMistakes } = useLocalMistakes();

  const [drillIndex, setDrillIndex] = useState(0);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'waiting' | 'correct' | 'wrong'>('waiting');
  const [drillSessionOver, setDrillSessionOver] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [inDrill, setInDrill] = useState(false);

  const shuffled = useMemo(() => shuffle(mistakes), [mistakes]);
  const current = shuffled[drillIndex];

  const check = () => {
    if (!current || status !== 'waiting') return;
    const trimmed = input.trim().toLowerCase();
    if (trimmed === current.romaji.toLowerCase()) {
      setStatus('correct');
      setCorrectCount((n) => n + 1);
      removeMistake(current.kana);
    } else {
      setStatus('wrong');
    }
  };

  const next = () => {
    if (drillIndex >= shuffled.length - 1) {
      setDrillSessionOver(true);
      return;
    }
    setDrillIndex((n) => n + 1);
    setInput('');
    setStatus('waiting');
  };

  const startDrill = () => {
    setInDrill(true);
    setDrillIndex(0);
    setInput('');
    setStatus('waiting');
    setDrillSessionOver(false);
    setCorrectCount(0);
  };

  if (mistakes.length === 0) {
    return (
      <div className="page">
        <header className="page-head">
          <h1 className="page-title">Mistakes</h1>
        </header>
        <div className="glass panel quiz-summary">
          <h2>No mistakes yet</h2>
          <p className="summary-note">
            Characters you get wrong in reading or listening practice show up here
            so you can drill them until they stick.
          </p>
          <Link className="btn btn-primary" to={chartPath} style={{ marginTop: 'var(--s-md)' }}>
            Back to the {scriptLabel} chart
          </Link>
        </div>
      </div>
    );
  }

  if (inDrill && drillSessionOver) {
    return (
      <div className="page">
        <header className="page-head">
          <h1 className="page-title">Mistakes</h1>
        </header>
        <div className="glass panel quiz-summary">
          <h2>Drill complete</h2>
          <dl className="summary-rows">
            <div>
              <dt>Correct</dt>
              <dd className="tabular">{correctCount}</dd>
            </div>
            <div>
              <dt>Remaining</dt>
              <dd className="tabular">{mistakes.length}</dd>
            </div>
          </dl>
          {mistakes.length > 0 && (
            <div className="missed-list">
              <h3>Still need practice</h3>
              <ul className="kana-cells" style={{ justifyContent: 'center', marginTop: 'var(--s-md)' }}>
                {mistakes.map((m) => (
                  <li key={m.kana}>
                    <div className="kana-cell kana-cell-missed">
                      <span className="kana-cell-glyph ja" lang="ja">{m.kana}</span>
                      <span className="kana-cell-romaji">{m.romaji}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div style={{ display: 'flex', gap: 'var(--s-md)', marginTop: 'var(--s-lg)', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button className="btn btn-primary" type="button" onClick={startDrill}>
              Drill again
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => setInDrill(false)}>
              Back to list
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (inDrill) {
    return (
      <div className="page">
        <header className="page-head">
          <h1 className="page-title">Mistake Drill</h1>
          <p className="page-sub">
            Type the romaji for each character you missed.
          </p>
        </header>

        <div className="practice-controls">
          <div className="practice-progress">
            <span className="practice-count tabular">{drillIndex + 1} / {shuffled.length}</span>
          </div>
        </div>

        <div className="glass panel reading-card" style={{ textAlign: 'center', maxWidth: '420px', margin: '0 auto' }}>
          <p className="kana-detail-glyph" style={{ fontSize: '5rem', marginBottom: 'var(--s-xl)' }}>
            {current.kana}
          </p>

          <input
            className={`reading-input ${status === 'correct' ? 'reading-input-correct' : status === 'wrong' ? 'reading-input-wrong' : ''}`}
            type="text"
            value={input}
            onChange={(e) => { if (status === 'waiting') setInput(e.target.value); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (status === 'waiting') check();
                else next();
              }
            }}
            placeholder="Type the romaji…"
            autoFocus
            autoComplete="off"
            disabled={status !== 'waiting'}
          />

          {status === 'waiting' ? (
            <button className="btn btn-primary" type="button" onClick={check} style={{ marginTop: 'var(--s-md)' }}>
              Check
            </button>
          ) : status === 'correct' ? (
            <div style={{ marginTop: 'var(--s-md)' }}>
              <p className="verdict-correct">✓ {current.romaji}</p>
              <button className="btn btn-primary" type="button" onClick={next} style={{ marginTop: 'var(--s-sm)' }}>
                Next →
              </button>
            </div>
          ) : (
            <div style={{ marginTop: 'var(--s-md)' }}>
              <p className="verdict-wrong">
                The answer is <strong>{current.romaji}</strong>
              </p>
              <button className="btn btn-primary" type="button" onClick={next} style={{ marginTop: 'var(--s-sm)' }}>
                Next →
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">Mistakes</h1>
        <p className="page-sub">
          {mistakes.length} {mistakes.length === 1 ? 'character' : 'characters'} to review.
        </p>
      </header>

      <div className="missed-list">
        <ul className="kana-cells">
          {mistakes.map((m) => (
            <li key={m.kana}>
              <button
                type="button"
                className="kana-cell kana-cell-missed"
                onClick={() => removeMistake(m.kana)}
                title="Remove from mistakes"
              >
                <span className="kana-cell-glyph ja" lang="ja">{m.kana}</span>
                <span className="kana-cell-romaji">{m.romaji}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div style={{ display: 'flex', gap: 'var(--s-md)', marginTop: 'var(--s-lg)', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" type="button" onClick={startDrill}>
          Drill all ({mistakes.length})
        </button>
        <button className="btn btn-secondary" type="button" onClick={clearMistakes}>
          Clear all
        </button>
        <Link className="btn btn-secondary" to={chartPath}>
          Back to {scriptLabel} chart
        </Link>
      </div>
    </div>
  );
}
