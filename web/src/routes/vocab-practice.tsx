import { useMemo, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';

import { useCorpus, type VocabItem } from '../components/library/useCorpus';
import { useBookmarks } from '../hooks/useBookmarks';
import { useVocabLists } from '../hooks/useVocabLists';
import { vocabRouteStyles } from '../styles/vocabRouteStyles';

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
  void vocabRouteStyles;
  const corpus = useCorpus();
  const { bookmarks } = useBookmarks();
  const { lists } = useVocabLists();

  const corpusItems = corpus.data?.items;
  const allItems = useMemo(
    () => corpusItems?.filter((item): item is VocabItem => item.kind === 'vocab') ?? [],
    [corpusItems],
  );

  const [pool, setPool] = useState<Pool>('all');
  const [run, setRun] = useState(0);
  const [index, setIndex] = useState(0);
  const [sessionOver, setSessionOver] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [missed, setMissed] = useState<VocabItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<'waiting' | 'right' | 'wrong'>('waiting');

  const source = useMemo(() => {
    if (pool === 'bookmarks') {
      const bookmarkIds = new Set(bookmarks.map((bookmark) => bookmark.id));
      return allItems.filter((item) => bookmarkIds.has(item.id));
    }
    if (pool !== 'all') {
      const list = lists.find((candidate) => candidate.id === pool);
      if (list) {
        const entryIds = new Set(list.entries.map((entry) => entry.id));
        return allItems.filter((item) => entryIds.has(item.id));
      }
    }
    return allItems;
  }, [allItems, bookmarks, lists, pool]);

  // A focused session is ten stable questions. The old implementation rebuilt
  // and reshuffled `source` on every answer render, so the question could change
  // underneath the selected result and an all-words run would be hundreds of questions.
  const shuffled = useMemo(() => {
    const mixed = shuffle(source);
    if (mixed.length === 0) return [];
    // `run` is the explicit new-session signal. Rotating after the shuffle also
    // makes the signal part of the resulting order rather than a dummy dep.
    const offset = run % mixed.length;
    return [...mixed.slice(offset), ...mixed.slice(0, offset)].slice(0, 10);
  }, [run, source]);
  const current = shuffled[index];

  // Distractors come from the full corpus so a one-word saved set still tests
  // recognition instead of showing a single self-evident option.
  const options = useMemo(() => {
    if (!current) return [];
    const usedMeanings = new Set([current.gloss.trim().toLocaleLowerCase()]);
    const others = shuffle(allItems).filter((item) => {
      if (item.id === current.id) return false;
      const meaning = item.gloss.trim().toLocaleLowerCase();
      if (usedMeanings.has(meaning)) return false;
      usedMeanings.add(meaning);
      return true;
    });
    return shuffle([current, ...others.slice(0, 3)]);
  }, [allItems, current]);

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
    setRun((currentRun) => currentRun + 1);
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
        <p className="card-note">Building a practice set…</p>
      </div>
    );
  }

  if (corpus.isError) {
    return (
      <div className="page">
        <header className="page-head"><h1 className="page-title">Vocab Practice</h1></header>
        <p className="note note-error"><strong>The vocabulary could not be loaded.</strong><span>The API may be asleep. Try again when it is available.</span></p>
        <Link className="btn btn-secondary" to="/vocabulary">Back to vocabulary</Link>
      </div>
    );
  }

  const listNames = lists.map((list) => ({ id: list.id, name: list.name }));
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
            <h3>Words to practise</h3>
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
          <h2>Nothing in {poolLabel}</h2>
          <p className="summary-note">Save a word or add one to this collection before practising it.</p>
          <div className="vocab-empty-actions">
            {pool !== 'all' && allItems.length > 0 ? <button type="button" className="btn btn-primary" onClick={() => { setPool('all'); restart(); }}>Use all course words</button> : null}
            <Link className="btn btn-secondary" to="/vocabulary">Browse vocabulary</Link>
          </div>
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
