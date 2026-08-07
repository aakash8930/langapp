import { useMemo, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';

import { useCorpus, type VocabItem } from '../components/library/useCorpus';
import { useBookmarks } from '../hooks/useBookmarks';
import { useVocabLists } from '../hooks/useVocabLists';

import '../components/library/vocab-browse.css';

type Pool = 'all' | 'bookmarks' | string;

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const Route = createFileRoute('/vocab-practice')({
  component: VocabPracticeRoute,
});

function VocabPracticeRoute() {
  const corpus = useCorpus();
  const { bookmarks } = useBookmarks();
  const { lists } = useVocabLists();

  const allItems = (corpus.data?.items.filter((i): i is VocabItem => i.kind === 'vocab') ?? []);

  const [pool, setPool] = useState<Pool>('all');
  const [index, setIndex] = useState(0);
  const [sessionOver, setSessionOver] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [missed, setMissed] = useState<VocabItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<'waiting' | 'right' | 'wrong'>('waiting');

  const getItems = (): VocabItem[] => {
    if (pool === 'bookmarks') {
      const bmIds = new Set(bookmarks.map((b) => b.id));
      return allItems.filter((i) => bmIds.has(i.id));
    }
    if (pool !== 'all') {
      const list = lists.find((l) => l.id === pool);
      if (list) {
        const entryIds = new Set(list.entries.map((e) => e.id));
        return allItems.filter((i) => entryIds.has(i.id));
      }
    }
    return allItems;
  };

  const source = getItems();
  const shuffled = useMemo(() => shuffle(source), [source, pool]);
  const current = shuffled[index];

  // Pick 4 options per question
  const options = useMemo(() => {
    if (!current) return [];
    const others = source.filter((i) => i.id !== current.id);
    const picked = shuffle(others).slice(0, 3);
    return shuffle([current, ...picked]);
  }, [current, source]);

  const choose = (item: VocabItem) => {
    if (status !== 'waiting') return;
    setSelectedId(item.id);
    if (item.id === current.id) {
      setStatus('right');
      setCorrect((n) => n + 1);
    } else {
      setStatus('wrong');
      setMissed((m) => [...m, current]);
    }
  };

  const next = () => {
    if (index >= shuffled.length - 1) {
      setSessionOver(true);
      return;
    }
    setIndex((n) => n + 1);
    setSelectedId(null);
    setStatus('waiting');
  };

  const restart = () => {
    setIndex(0);
    setCorrect(0);
    setMissed([]);
    setSelectedId(null);
    setStatus('waiting');
    setSessionOver(false);
  };

  if (corpus.isPending) {
    return (
      <div className="page">
        <header className="page-head">
          <h1 className="page-title">Vocab Practice</h1>
        </header>
        <p className="card-note">Loading…</p>
      </div>
    );
  }

  const listNames = lists.map((l) => ({ id: l.id, name: l.name }));
  const poolLabel =
    pool === 'all' ? 'All words' :
    pool === 'bookmarks' ? 'Bookmarks' :
    lists.find((l) => l.id === pool)?.name ?? 'All words';

  if (sessionOver) {
    const total = correct + missed.length;
    return (
      <div className="glass panel quiz-summary">
        <h2>Practice complete</h2>
        <p style={{ color: 'var(--ink-soft)' }}>From: {poolLabel} ({total} words)</p>
        <dl className="summary-rows">
          <div><dt>Correct</dt><dd className="tabular">{correct}</dd></div>
          <div><dt>Missed</dt><dd className="tabular">{missed.length}</dd></div>
          <div><dt>Accuracy</dt><dd className="tabular">{total > 0 ? Math.round((correct / total) * 100) : 0}%</dd></div>
        </dl>
        {missed.length > 0 && (
          <div className="missed-list">
            <h3>Words to review</h3>
            <ul className="kana-cells" style={{ justifyContent: 'center', marginTop: 'var(--s-md)' }}>
              {missed.map((m) => (
                <li key={m.id}>
                  <div className="kana-cell kana-cell-missed" style={{ width: 'auto', minWidth: '64px', padding: 'var(--s-sm)' }}>
                    <span className="kana-cell-glyph ja" lang="ja" style={{ fontSize: '1rem' }}>{m.lemma}</span>
                    <span className="kana-cell-romaji" style={{ fontSize: '0.7rem' }}>{m.gloss}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div style={{ display: 'flex', gap: 'var(--s-md)', marginTop: 'var(--s-lg)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="btn btn-primary" type="button" onClick={restart}>Practice again</button>
          <Link className="btn btn-secondary" to="/vocabulary">Back to vocabulary</Link>
        </div>
      </div>
    );
  }

  if (source.length === 0) {
    return (
      <div className="page">
        <header className="page-head">
          <h1 className="page-title">Vocab Practice</h1>
        </header>
        <div className="glass panel quiz-summary">
          <h2>Nothing to practice</h2>
          <p className="summary-note">No words in this set.</p>
          <Link className="btn btn-primary" to="/vocabulary">Browse vocabulary</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">Vocab Practice</h1>
        <p className="page-sub">What does this word mean?</p>
      </header>

      <div className="practice-controls">
        <div className="practice-toggle-bar">
          <button
            type="button"
            className={`btn btn-sm ${pool === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setPool('all'); restart(); }}
          >All</button>
          <button
            type="button"
            className={`btn btn-sm ${pool === 'bookmarks' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setPool('bookmarks'); restart(); }}
          >Bookmarks ({bookmarks.length})</button>
          {listNames.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`btn btn-sm ${pool === l.id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setPool(l.id); restart(); }}
            >{l.name}</button>
          ))}
        </div>
        <div className="practice-progress">
          <span className="practice-count tabular">{index + 1} / {shuffled.length}</span>
        </div>
      </div>

      <div className="glass panel vocab-quiz-card" style={{ padding: 'var(--s-xl)' }}>
        <p className="vocab-quiz-prompt ja" lang="ja">{current.lemma}</p>
        {current.reading !== current.lemma && (
          <p className="card-note" style={{ marginBottom: 'var(--s-lg)' }}>{current.reading}</p>
        )}

        <div className="vocab-quiz-options">
          {options.map((opt) => {
            let cls = 'vocab-quiz-option';
            if (status !== 'waiting' && opt.id === current.id) cls += ' vocab-quiz-option-correct';
            if (status !== 'waiting' && selectedId === opt.id && opt.id !== current.id) cls += ' vocab-quiz-option-wrong';
            return (
              <button
                key={opt.id}
                type="button"
                className={cls}
                onClick={() => choose(opt)}
                disabled={status !== 'waiting'}
              >
                {opt.gloss}
              </button>
            );
          })}
        </div>

        {status === 'right' ? (
          <div style={{ marginTop: 'var(--s-md)' }}>
            <p className="verdict-correct">✓ Correct!</p>
            <button className="btn btn-primary" type="button" onClick={next} style={{ marginTop: 'var(--s-sm)' }}>Next →</button>
          </div>
        ) : status === 'wrong' ? (
          <div style={{ marginTop: 'var(--s-md)' }}>
            <p className="verdict-wrong">{current.lemma} = <strong>{current.gloss}</strong></p>
            <button className="btn btn-primary" type="button" onClick={next} style={{ marginTop: 'var(--s-sm)' }}>Next →</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
