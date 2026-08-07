import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';

import { API_BASE } from '../../api';
import { useKanaData, type KanaCurriculumRow } from '../../hooks/useKanaData';
import { useLocalMistakes } from '../../hooks/useLocalMistakes';
import { useSession } from '../../useSession';

import './practice.css';

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pickOptions(correct: KanaCurriculumRow, pool: KanaCurriculumRow[], count: number): KanaCurriculumRow[] {
  const others = pool.filter((e) => e.id !== correct.id);
  const selected = shuffle(others).slice(0, count - 1);
  return shuffle([correct, ...selected]);
}

export function KanaListening({ script }: { script: 'hiragana' | 'katakana' }) {
  const { kana, learned, isPending, isError, chartPath, scriptLabel } = useKanaData(script);
  const { session } = useSession();
  const { add: addMistake, remove: removeMistake } = useLocalMistakes();
  const audioSpeed = session.state === 'signedIn' ? session.user.settings.audioSpeed : 1;

  const items = learned.length > 0 ? learned : kana;
  const shuffled = useMemo(() => shuffle(items), [items]);

  const [index, setIndex] = useState(0);
  const [options, setOptions] = useState<KanaCurriculumRow[]>(() =>
    pickOptions(shuffled[0], items, 4),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<'waiting' | 'correct' | 'wrong'>('waiting');
  const [missed, setMissed] = useState<KanaCurriculumRow[]>([]);
  const [sessionOver, setSessionOver] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const selected = shuffled[index];

  const play = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const src = `${API_BASE}/content/kana/${encodeURIComponent(selected.id)}/audio`;
    const el = new Audio(src);
    el.currentTime = 0;
    el.playbackRate = audioSpeed;
    audioRef.current = el;
    void el.play().catch(() => {});
  }, [selected]);

  const audioTriggered = useRef(false);
  useEffect(() => {
    if (!audioTriggered.current) {
      audioTriggered.current = true;
      return;
    }
    const timer = setTimeout(() => play(), 200);
    return () => clearTimeout(timer);
  }, [play]);

  useEffect(() => {
    const timer = setTimeout(() => play(), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = useCallback((entry: KanaCurriculumRow) => {
    if (status !== 'waiting') return;
    setSelectedId(entry.id);

    if (entry.id === selected.id) {
      setStatus('correct');
      setCorrectCount((n) => n + 1);
      removeMistake(selected.kana);
    } else {
      setStatus('wrong');
      setMissed((m) => [...m, selected]);
      addMistake(selected.kana, selected.romaji);
    }
  }, [status, selected, removeMistake, addMistake]);

  const next = useCallback(() => {
    const nextIndex = index + 1;
    if (nextIndex >= shuffled.length) {
      setSessionOver(true);
      return;
    }
    setIndex(nextIndex);
    setOptions(pickOptions(shuffled[nextIndex], items, 4));
    setSelectedId(null);
    setStatus('waiting');
  }, [index, shuffled, items]);

  const restart = useCallback(() => {
    setIndex(0);
    setOptions(pickOptions(shuffled[0], items, 4));
    setSessionOver(false);
    setCorrectCount(0);
    setMissed([]);
    setSelectedId(null);
    setStatus('waiting');
    audioTriggered.current = false;
  }, [shuffled, items]);

  if (isPending) {
    return (
      <div className="page">
        <header className="page-head">
          <h1 className="page-title">{scriptLabel} Listening</h1>
        </header>
        <p className="card-note">Loading characters…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="page">
        <header className="page-head">
          <h1 className="page-title">{scriptLabel} Listening</h1>
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
        <h2>Listening complete</h2>
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
          </div>
        )}
        <div style={{ display: 'flex', gap: 'var(--s-md)', marginTop: 'var(--s-lg)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="btn btn-primary" type="button" onClick={restart}>
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
        <h1 className="page-title">{scriptLabel} Listening</h1>
        <p className="page-sub">
          Hear the character — then pick the right kana.
        </p>
      </header>

      <div className="practice-controls">
        <div className="practice-progress">
          <span className="practice-count tabular">{index + 1} / {shuffled.length}</span>
        </div>
      </div>

      <div className="glass panel listening-card" style={{ textAlign: 'center', maxWidth: '460px', margin: '0 auto' }}>
        <button
          type="button"
          className="listening-play-btn"
          onClick={play}
          style={{ fontSize: '2.5rem', padding: 'var(--s-lg) var(--s-xl)', marginBottom: 'var(--s-lg)' }}
        >
          ▶
        </button>
        <p className="card-note" style={{ marginBottom: 'var(--s-lg)' }}>
          Tap to hear it again
        </p>

        <div className="listening-options">
          {options.map((entry) => {
            let cls = 'listening-option';
            if (status === 'waiting' && selectedId === entry.id) cls += ' listening-option-pressed';
            if (status !== 'waiting' && entry.id === selected.id) cls += ' listening-option-correct';
            if (status !== 'waiting' && selectedId === entry.id && entry.id !== selected.id) cls += ' listening-option-wrong';

            return (
              <button
                key={entry.id}
                type="button"
                className={cls}
                onClick={() => choose(entry)}
                disabled={status !== 'waiting'}
              >
                {entry.kana}
              </button>
            );
          })}
        </div>

        {status === 'correct' ? (
          <div style={{ marginTop: 'var(--s-md)' }}>
            <p className="verdict-correct">✓ {selected.romaji}</p>
            <button className="btn btn-primary" type="button" onClick={next} style={{ marginTop: 'var(--s-sm)' }}>
              Next →
            </button>
          </div>
        ) : status === 'wrong' ? (
          <div style={{ marginTop: 'var(--s-md)' }}>
            <p className="verdict-wrong">
              That was <strong>{selected.kana}</strong> ({selected.romaji})
            </p>
            <button className="btn btn-primary" type="button" onClick={next} style={{ marginTop: 'var(--s-sm)' }}>
              Next →
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
