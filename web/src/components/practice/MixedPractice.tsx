import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';

import { useCorpus } from '../library/useCorpus';
import '../library/vocab-browse.css';
import './practice.css';

interface MixedQuestion {
  id: string;
  kind: 'vocab' | 'kanji' | 'grammar';
  prompt: string;
  secondary?: string;
  options: string[];
  answer: number;
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function MixedPracticePage() {
  const corpus = useCorpus();
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);

  const questions = useMemo(() => {
    if (!corpus.data) return [] as MixedQuestion[];
    const items = corpus.data.items;
    const vocab = items.filter((i) => i.kind === 'vocab');
    const kanji = items.filter((i) => i.kind === 'kanji');
    const grammar = items.filter((i) => i.kind === 'grammar');

    const qs: MixedQuestion[] = [];

    for (const v of shuffle(vocab).slice(0, 6)) {
      const others = shuffle(vocab.filter((o) => o.id !== v.id)).slice(0, 3);
      qs.push({
        id: v.id, kind: 'vocab',
        prompt: 'What does this word mean?', secondary: v.lemma,
        options: shuffle([v.gloss, ...others.map((o) => o.gloss)]),
        answer: 0,
      });
    }

    for (const k of shuffle(kanji).slice(0, 4)) {
      const others = shuffle(kanji.filter((o) => o.id !== k.id)).slice(0, 3);
      qs.push({
        id: k.id, kind: 'kanji',
        prompt: 'What does this kanji mean?', secondary: k.char,
        options: shuffle([k.meanings[0] ?? '—', ...others.map((o) => o.meanings[0] ?? '—')]),
        answer: 0,
      });
    }

    for (const g of shuffle(grammar).slice(0, 2)) {
      const ex = g.examples[0];
      if (!ex) continue;
      const others = shuffle(grammar.filter((o) => o.id !== g.id)).slice(0, 3);
      const wordOptions = others.map((o) => o.examples[0]?.answer ?? '—').filter(Boolean);
      qs.push({
        id: g.id, kind: 'grammar',
        prompt: 'Fill the gap: ' + ex.sentence.replace('＿', '…'),
        secondary: ex.gloss,
        options: shuffle([ex.answer, ...wordOptions]),
        answer: 0,
      });
    }

    return shuffle(qs);
  }, [corpus.data]);

  const answer = (optIdx: number) => {
    setSelected(optIdx);
    if (optIdx === 0) setCorrect((c) => c + 1);
    setTimeout(() => {
      const next = index + 1;
      if (next >= questions.length) setFinished(true);
      else { setIndex(next); setSelected(null); }
    }, 500);
  };

  if (corpus.isPending) {
    return <div className="page"><header className="page-head"><h1 className="page-title">Mixed Practice</h1></header><p className="card-note">Loading…</p></div>;
  }

  if (!started) {
    return (
      <div className="page">
        <header className="page-head">
          <h1 className="page-title">Mixed Practice</h1>
          <p className="page-sub">Random questions from vocabulary, kanji, and grammar — all shuffled together.</p>
        </header>
        <div className="glass panel" style={{ maxWidth: '500px', margin: '0 auto', padding: 'var(--s-xl)', textAlign: 'center' }}>
          <p style={{ color: 'var(--ink-soft)', marginBottom: 'var(--s-lg)' }}>
            {questions.length} questions: ~6 vocab, ~4 kanji, ~2 grammar
          </p>
          <button className="btn btn-primary" onClick={() => setStarted(true)} style={{ width: '100%' }}>
            Start Mixed Practice
          </button>
        </div>
      </div>
    );
  }

  if (finished) {
    const total = questions.length;
    const score = Math.round((correct / total) * 100);
    return (
      <div className="glass panel quiz-summary">
        <h2>Mixed Practice Complete</h2>
        <dl className="summary-rows">
          <div><dt>Correct</dt><dd className="tabular">{correct} of {total}</dd></div>
          <div><dt>Score</dt><dd className="tabular" style={{ color: score >= 60 ? 'var(--brand-success)' : 'var(--shu)' }}>{score}%</dd></div>
        </dl>
        <div style={{ display: 'flex', gap: 'var(--s-md)', marginTop: 'var(--s-lg)', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => { setStarted(false); setIndex(0); setCorrect(0); setSelected(null); setFinished(false); }}>
            Practice again
          </button>
          <Link className="btn btn-secondary" to="/practice-hub">Practice Hub</Link>
        </div>
      </div>
    );
  }

  const q = questions[index];

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">Mixed Practice</h1>
      </header>

      <div className="practice-controls">
        <span className="vocab-tag" style={{ background: q.kind === 'vocab' ? 'color-mix(in srgb, var(--brand-primary) 16%, transparent)' : q.kind === 'kanji' ? 'color-mix(in srgb, var(--shu) 16%, transparent)' : 'color-mix(in srgb, var(--brand-success) 16%, transparent)' }}>
          {q.kind}
        </span>
        <span className="practice-count tabular">{index + 1} / {questions.length}</span>
      </div>

      <div className="glass panel" style={{ maxWidth: '560px', margin: '0 auto', padding: 'var(--s-xl)' }}>
        <p style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-small)', marginBottom: 'var(--s-sm)' }}>{q.prompt}</p>

        {q.kind === 'vocab' && <p className="vocab-quiz-prompt" style={{ fontSize: '2.5rem' }}>{q.secondary}</p>}
        {q.kind === 'kanji' && <p className="kana-detail-glyph" style={{ fontSize: '3.5rem', marginBottom: 'var(--s-lg)' }}>{q.secondary}</p>}
        {q.kind === 'grammar' && <p className="example-gloss" style={{ marginBottom: 'var(--s-md)', fontStyle: 'italic' }}>({q.secondary})</p>}

        <div className="vocab-quiz-options">
          {q.options.map((opt, oi) => {
            let cls = 'vocab-quiz-option';
            if (selected !== null && oi === 0) cls += ' vocab-quiz-option-correct';
            if (selected === oi && oi !== 0) cls += ' vocab-quiz-option-wrong';
            return (
              <button key={oi} type="button" className={cls} onClick={() => selected === null && answer(oi)} disabled={selected !== null}>
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
