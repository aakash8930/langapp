import { useState } from 'react';
import { Link } from '@tanstack/react-router';

import '../library/vocab-browse.css';
import './practice.css';

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

interface SentenceTemplate {
  ja: string[];
  romaji: string;
  gloss: string;
}

const TEMPLATES: SentenceTemplate[] = [
  { ja: ['わたし', 'は', 'せんせい', 'です'], romaji: 'watashi wa sensei desu', gloss: 'I am a teacher.' },
  { ja: ['あなた', 'は', 'がくせい', 'です', 'か'], romaji: 'anata wa gakusei desu ka', gloss: 'Are you a student?' },
  { ja: ['ほん', 'を', 'よみます'], romaji: 'hon o yomimasu', gloss: 'I read a book.' },
  { ja: ['くるま', 'を', 'かいます'], romaji: 'kuruma o kaimasu', gloss: 'I buy a car.' },
  { ja: ['うみ', 'に', 'いきます'], romaji: 'umi ni ikimasu', gloss: 'I go to the sea.' },
  { ja: ['みせ', 'で', 'かいます'], romaji: 'mise de kaimasu', gloss: 'I buy at the shop.' },
  { ja: ['わたし', 'の', 'ほん', 'です'], romaji: 'watashi no hon desu', gloss: 'It is my book.' },
  { ja: ['いもうと', 'も', 'せんせい', 'です'], romaji: 'imouto mo sensei desu', gloss: 'My sister is also a teacher.' },
  { ja: ['ほん', 'と', 'かみ', 'を', 'かいます'], romaji: 'hon to kami o kaimasu', gloss: 'I buy a book and paper.' },
  { ja: ['おおきい', 'いえ', 'です'], romaji: 'ookii ie desu', gloss: 'It is a big house.' },
];

export function SentenceBuilderPage() {
  const [templateIdx, setTemplateIdx] = useState(0);
  const [built, setBuilt] = useState<string[]>([]);
  const [available, setAvailable] = useState<string[]>(() => shuffle([...TEMPLATES[0].ja]));
  const [status, setStatus] = useState<'building' | 'correct' | 'wrong'>('building');
  const [sessionOver, setSessionOver] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalAttempted, setTotalAttempted] = useState(0);

  const template = TEMPLATES[templateIdx];

  const addToken = (token: string, idx: number) => {
    setBuilt((b) => [...b, token]);
    setAvailable((a) => a.filter((_, i) => i !== idx));
    setStatus('building');
  };

  const removeToken = (idx: number) => {
    setAvailable((a) => [...a, built[idx]]);
    setBuilt((b) => b.filter((_, i) => i !== idx));
    setStatus('building');
  };

  const check = () => {
    if (built.length !== template.ja.length) return;
    setTotalAttempted((n) => n + 1);
    if (built.join(' ') === template.ja.join(' ')) {
      setStatus('correct');
      setCorrectCount((n) => n + 1);
    } else {
      setStatus('wrong');
    }
  };

  const next = () => {
    const nextIdx = templateIdx + 1;
    if (nextIdx >= TEMPLATES.length) {
      setSessionOver(true);
      return;
    }
    setTemplateIdx(nextIdx);
    setBuilt([]);
    setAvailable(shuffle([...TEMPLATES[nextIdx].ja]));
    setStatus('building');
  };

  const restart = () => {
    setTemplateIdx(0);
    setBuilt([]);
    setAvailable(shuffle([...TEMPLATES[0].ja]));
    setStatus('building');
    setSessionOver(false);
    setCorrectCount(0);
    setTotalAttempted(0);
  };

  if (sessionOver) {
    return (
      <div className="glass panel quiz-summary">
        <h2>Sentence Builder Complete!</h2>
        <dl className="summary-rows">
          <div><dt>Correct</dt><dd className="tabular">{correctCount}</dd></div>
          <div><dt>Attempted</dt><dd className="tabular">{totalAttempted}</dd></div>
        </dl>
        <div style={{ display: 'flex', gap: 'var(--s-md)', marginTop: 'var(--s-lg)', justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={restart}>Start again</button>
          <Link className="btn btn-secondary" to="/">Back</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">Sentence Builder</h1>
        <p className="page-sub">Arrange the words to form the correct Japanese sentence.</p>
      </header>

      <div className="practice-controls">
        <div className="practice-progress">
          <span className="practice-count tabular">{templateIdx + 1} / {TEMPLATES.length}</span>
        </div>
      </div>

      <div className="glass panel" style={{ maxWidth: '640px', margin: '0 auto', padding: 'var(--s-xl)' }}>
        <p className="example-gloss" style={{ marginBottom: 'var(--s-lg)', textAlign: 'center', fontSize: 'var(--text-large)' }}>
          {template.gloss}
        </p>

        <div
          style={{
            minHeight: '56px',
            border: '2px dashed var(--hairline)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--s-md)',
            marginBottom: 'var(--s-lg)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--s-sm)',
            alignItems: 'center',
            justifyContent: built.length === 0 ? 'center' : 'flex-start',
            background: status === 'correct' ? 'color-mix(in srgb, var(--brand-success) 8%, transparent)' :
                        status === 'wrong' ? 'color-mix(in srgb, var(--danger) 8%, transparent)' : 'var(--surface)',
          }}
        >
          {built.length === 0 ? (
            <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-small)' }}>Tap words below to build the sentence</span>
          ) : (
            built.map((token, idx) => (
              <button
                key={`built-${idx}`}
                type="button"
                className="vocab-tag"
                onClick={() => removeToken(idx)}
                style={{ cursor: 'pointer', padding: 'var(--s-sm) var(--s-md)', fontSize: '1.1rem', border: '1px solid var(--hairline)', background: 'var(--surface)' }}
              >
                {token}
              </button>
            ))
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s-sm)', justifyContent: 'center', marginBottom: 'var(--s-lg)' }}>
          {available.map((token, idx) => (
            <button
              key={`avail-${idx}`}
              type="button"
              className="vocab-tag vocab-tag-jlpt"
              onClick={() => addToken(token, idx)}
              disabled={status !== 'building'}
              style={{ cursor: 'pointer', padding: 'var(--s-sm) var(--s-lg)', fontSize: '1.15rem', fontWeight: 600 }}
            >
              {token}
            </button>
          ))}
        </div>

        {status === 'building' ? (
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={check} disabled={built.length !== template.ja.length}>
            {built.length < template.ja.length ? `Add ${template.ja.length - built.length} more` : 'Check'}
          </button>
        ) : status === 'correct' ? (
          <div style={{ textAlign: 'center' }}>
            <p className="verdict-correct">✓ {template.romaji}</p>
            <button className="btn btn-primary" onClick={next} style={{ marginTop: 'var(--s-sm)' }}>Next →</button>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <p className="verdict-wrong">Correct: <strong>{template.ja.join(' ')}</strong> ({template.romaji})</p>
            <button className="btn btn-primary" onClick={next} style={{ marginTop: 'var(--s-sm)' }}>Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}
