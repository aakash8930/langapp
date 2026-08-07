import { useCallback, useMemo, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';

import { useKanaData, type KanaCurriculumRow } from '../../hooks/useKanaData';
import { useLocalMistakes } from '../../hooks/useLocalMistakes';
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

export function KanaReading({ script }: { script: 'hiragana' | 'katakana' }) {
  const { learned, kana, isPending, isError, chartPath, scriptLabel } = useKanaData(script);
  const { session } = useSession();
  const { add: addMistake, remove: removeMistake } = useLocalMistakes();

  const [pool, setPool] = useState<'learned' | 'all'>('learned');
  const items = pool === 'learned' && learned.length > 0 ? learned : kana;
  const shuffled = useMemo(() => shuffle(items), [items]);

  const [index, setIndex] = useState(0);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'waiting' | 'correct' | 'wrong'>('waiting');
  const [missed, setMissed] = useState<KanaCurriculumRow[]>([]);
  const [sessionOver, setSessionOver] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [shuffledMissed, setShuffledMissed] = useState<KanaCurriculumRow[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeList = shuffledMissed ?? shuffled;
  const activeCurrent = activeList[index];

  const check = useCallback(() => {
    if (!activeCurrent || status !== 'waiting') return;
    const trimmed = input.trim().toLowerCase();
    const expected = activeCurrent.romaji.toLowerCase();

    if (trimmed === expected) {
      setStatus('correct');
      setCorrectCount((n) => n + 1);
      removeMistake(activeCurrent.kana);
    } else {
      setStatus('wrong');
      setMissed((m) => [...m, activeCurrent]);
      addMistake(activeCurrent.kana, activeCurrent.romaji);
    }
  }, [activeCurrent, input, status, removeMistake, addMistake]);

  const next = useCallback(() => {
    if (index >= activeList.length - 1) {
      setSessionOver(true);
      return;
    }
    setIndex((n) => n + 1);
    setInput('');
    setStatus('waiting');
    queueMicrotask(() => inputRef.current?.focus());
  }, [index, activeList.length]);

  const retryMissed = useCallback(() => {
    if (missed.length === 0) return;
    setShuffledMissed(shuffle(missed));
    setMissed([]);
    setIndex(0);
    setInput('');
    setStatus('waiting');
  }, [missed]);

  if (isPending) {
    return (
      <div className="page">
        <header className="page-head">
          <h1 className="page-title">{scriptLabel} Reading</h1>
        </header>
        <p className="card-note">Loading characters…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="page">
        <header className="page-head">
          <h1 className="page-title">{scriptLabel} Reading</h1>
        </header>
        <p className="note note-error">
          <strong>Could not load characters.</strong>
        </p>
      </div>
    );
  }

  if (sessionOver) {
    return (
      <div className="glass panel quiz-summary">
        <h2>Reading complete</h2>
        <dl className="summary-rows">
          <div>
            <dt>Correct</dt>
            <dd className="tabular">{correctCount}</dd>
          </div>
          <div>
            <dt>Missed</dt>
            <dd className="tabular">{missed.length}</dd>
          </div>
        </dl>
        {missed.length > 0 && (
          <div className="missed-list">
            <h3>Characters to revisit</h3>
            <ul className="kana-cells" style={{ justifyContent: 'center', marginTop: 'var(--s-md)' }}>
              {missed.map((m) => (
                <li key={m.id}>
                  <div className="kana-cell kana-cell-missed">
                    <span className="kana-cell-glyph ja" lang="ja">{m.kana}</span>
                    <span className="kana-cell-romaji">{m.romaji}</span>
                  </div>
                </li>
              ))}
            </ul>
            <p className="card-note" style={{ marginTop: 'var(--s-md)' }}>
              Mistakes are saved so you can drill them later.
            </p>
          </div>
        )}
        <div style={{ display: 'flex', gap: 'var(--s-md)', marginTop: 'var(--s-lg)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="btn btn-primary" type="button" onClick={() => {
            setIndex(0);
            setSessionOver(false);
            setCorrectCount(0);
            setMissed([]);
            setShuffledMissed(null);
            setInput('');
            setStatus('waiting');
          }}>
            Start again
          </button>
          {missed.length > 0 && (
            <button className="btn btn-secondary" type="button" onClick={retryMissed}>
              Retry missed ({missed.length})
            </button>
          )}
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
        <h1 className="page-title">{scriptLabel} Reading</h1>
        <p className="page-sub">
          You see the kana — type its romaji reading.
        </p>
      </header>

      <div className="practice-controls">
        {session.state === 'signedIn' && (
          <div className="practice-toggle-bar">
            <button
              type="button"
              className={`btn btn-sm ${pool === 'learned' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setPool('learned'); }}
            >
              Learned ({learned.length})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${pool === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setPool('all'); }}
            >
              All ({kana.length})
            </button>
          </div>
        )}

        <div className="practice-progress">
          <span className="practice-count tabular">{index + 1} / {activeList.length}</span>
        </div>
      </div>

      <div className="glass panel reading-card" style={{ textAlign: 'center', maxWidth: '420px', margin: '0 auto' }}>
        <p className="kana-detail-glyph" style={{ fontSize: '5rem', marginBottom: 'var(--s-xl)' }}>
          {activeCurrent.kana}
        </p>

        <div style={{ display: 'flex', gap: 'var(--s-md)', justifyContent: 'center', marginBottom: 'var(--s-md)' }}>
          <SpeakButton kanaId={activeCurrent.id} label="Hear it" />
        </div>

        <input
          ref={inputRef}
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
            <p className="verdict-correct">✓ {activeCurrent.romaji}</p>
            <button className="btn btn-primary" type="button" onClick={next} style={{ marginTop: 'var(--s-sm)' }}>
              Next →
            </button>
          </div>
        ) : (
          <div style={{ marginTop: 'var(--s-md)' }}>
            <p className="verdict-wrong">
              ✗ You typed <strong>{input.trim() || '(empty)'}</strong>{' '}
              — the answer is <strong>{activeCurrent.romaji}</strong>
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
