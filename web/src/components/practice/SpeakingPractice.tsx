import { useState } from 'react';
import { SpeechQuiz } from '../SpeechQuiz';

import '../library/vocab-browse.css';

export function SpeakingPractice() {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const prompts = [
    'わたし', 'あなた', 'せんせい', 'がくせい',
    'おはよう', 'こんにちは', 'さようなら',
    'ありがとう', 'すみません', 'はい',
    'ほん', 'くるま', 'いえ', 'みせ',
    'やま', 'うみ', 'そら', 'はな',
  ];

  const randomPrompt = () => {
    const p = prompts[Math.floor(Math.random() * prompts.length)];
    setPrompt(p);
    setResult(null);
    setSubmitted(false);
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">Speaking Practice</h1>
        <p className="page-sub">
          Read the word aloud in Japanese. Your browser will transcribe what you say.
        </p>
      </header>

      <div className="glass panel" style={{ maxWidth: '520px', margin: '0 auto', padding: 'var(--s-xl)', textAlign: 'center' }}>
        {!prompt ? (
          <>
            <p style={{ marginBottom: 'var(--s-lg)', color: 'var(--ink-soft)' }}>
              Tap the button to get a random word, then speak it aloud.
            </p>
            <button className="btn btn-primary" onClick={randomPrompt}>
              Get a word
            </button>
          </>
        ) : (
          <>
            <p className="kana-detail-glyph" style={{ fontSize: '4rem', marginBottom: 'var(--s-sm)' }}>
              {prompt}
            </p>
            <p className="card-note" style={{ marginBottom: 'var(--s-lg)' }}>
              Speak this word clearly
            </p>

            {!submitted && (
              <SpeechQuiz
                disabled={false}
                onSubmit={(text) => {
                  const normalized = text.replace(/[\s\u3000]+/g, '').toLowerCase();
                  const target = prompt.toLowerCase();
                  setResult(normalized.includes(target) ? 'correct' : 'wrong');
                  setSubmitted(true);
                }}
              />
            )}

            {submitted && (
              <div style={{ marginTop: 'var(--s-md)' }}>
                {result === 'correct' ? (
                  <p className="verdict-correct">✓ Well done!</p>
                ) : (
                  <p className="verdict-wrong">Try again — speak clearly and at a natural pace.</p>
                )}
                <div style={{ display: 'flex', gap: 'var(--s-md)', justifyContent: 'center', marginTop: 'var(--s-md)' }}>
                  <button className="btn btn-primary" onClick={randomPrompt}>Next word</button>
                  <button className="btn btn-secondary" onClick={() => { setSubmitted(false); }}>Try again</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <p className="card-note" style={{ marginTop: 'var(--s-lg)', textAlign: 'center' }}>
        Uses your browser&apos;s speech recognition. Works in Chrome and Edge. Safari and Firefox support is limited.
      </p>
    </div>
  );
}
