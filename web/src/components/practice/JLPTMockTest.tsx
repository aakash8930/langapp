import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';

import '../library/vocab-browse.css';
import './practice.css';
import { saveJlptResult, type JLPTSection } from './jlptData';

const MOCK_QUESTIONS = [
  { question: '「わたし＿せんせいです。」に入るのは？', options: ['は', 'を', 'に', 'で'], answer: 0, topic: 'Grammar' },
  { question: '「ねこ」の意味は？', options: ['dog', 'cat', 'bird', 'fish'], answer: 1, topic: 'Vocabulary' },
  { question: '「山」の読み方は？', options: ['やま', 'かわ', 'うみ', 'そら'], answer: 0, topic: 'Kanji' },
  { question: '「わたしはほん＿よみます。」', options: ['を', 'は', 'に', 'の'], answer: 0, topic: 'Grammar' },
  { question: '「いぬ」の意味は？', options: ['cat', 'bird', 'dog', 'fish'], answer: 2, topic: 'Vocabulary' },
  { question: '「水」の読み方は？', options: ['ひ', 'みず', 'かぜ', 'つち'], answer: 1, topic: 'Kanji' },
  { question: '「あなたはがくせいです＿。」', options: ['は', 'か', 'を', 'の'], answer: 1, topic: 'Grammar' },
  { question: '「花」の読み方は？', options: ['はな', 'くさ', 'き', 'み'], answer: 0, topic: 'Kanji' },
  { question: '「くるま」の意味は？', options: ['train', 'bus', 'car', 'bike'], answer: 2, topic: 'Vocabulary' },
  { question: '「に」の使い方で正しいのは？', options: ['場所に行く', '場所で買う', '物を食べる', '人と話す'], answer: 0, topic: 'Grammar' },
  { question: '「空」の読み方は？', options: ['あめ', 'そら', 'ゆき', 'くも'], answer: 1, topic: 'Kanji' },
  { question: '「あつい」の反対語は？', options: ['たかい', 'さむい', 'あたらしい', 'ふるい'], answer: 1, topic: 'Vocabulary' },
];

export function JLPTMockTestPage() {
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timer, setTimer] = useState<ReturnType<typeof setInterval> | null>(null);
  const [resultSaved, setResultSaved] = useState(false);

  useEffect(() => {
    if (!finished || resultSaved) return;
    const sections: Record<JLPTSection, { correct: number; total: number }> = {
      Vocabulary: { correct: 0, total: 0 },
      'Grammar & Reading': { correct: 0, total: 0 },
      Listening: { correct: 0, total: 0 },
    };
    MOCK_QUESTIONS.forEach((question, questionIndex) => {
      const section: JLPTSection = question.topic === 'Grammar' ? 'Grammar & Reading' : 'Vocabulary';
      sections[section].total += 1;
      if (answers[questionIndex] === question.answer) sections[section].correct += 1;
    });
    const correct = answers.filter((answer, questionIndex) => answer === MOCK_QUESTIONS[questionIndex].answer).length;
    saveJlptResult({
      id: `${Date.now()}`, date: new Date().toISOString(), score: Math.round((correct / MOCK_QUESTIONS.length) * 100),
      total: MOCK_QUESTIONS.length, passed: correct / MOCK_QUESTIONS.length >= 0.6, level: 'N5', sections,
    });
    setResultSaved(true);
  }, [answers, finished, resultSaved]);

  const start = () => {
    setStarted(true);
    setTimeLeft(300);
    const t = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(t);
          setFinished(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    setTimer(t);
  };

  const answer = (optIdx: number) => {
    setSelected(optIdx);
    setAnswers((a) => [...a, optIdx]);
    setTimeout(() => {
      const next = index + 1;
      if (next >= MOCK_QUESTIONS.length) {
        if (timer) clearInterval(timer);
        setFinished(true);
      } else {
        setIndex(next);
        setSelected(null);
      }
    }, 400);
  };

  if (!started) {
    return (
      <div className="page">
        <header className="page-head">
          <h1 className="page-title">JLPT N5 Mock Test</h1>
          <p className="page-sub">12 questions · 5 minutes · Covers vocabulary, kanji, and grammar.</p>
        </header>
        <div className="glass panel" style={{ maxWidth: '500px', margin: '0 auto', padding: 'var(--s-xl)', textAlign: 'center' }}>
          <p style={{ color: 'var(--ink-soft)', marginBottom: 'var(--s-lg)' }}>
            This is a simulated JLPT N5-style test. Answer all questions within the time limit.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-md)', alignItems: 'center', marginBottom: 'var(--s-lg)' }}>
            <div className="stat-tile glass" style={{ minWidth: '200px', textAlign: 'center' }}>
              <p className="stat-tile-label">Questions</p>
              <p className="stat-tile-value tabular">{MOCK_QUESTIONS.length}</p>
            </div>
            <div className="stat-tile glass" style={{ minWidth: '200px', textAlign: 'center' }}>
              <p className="stat-tile-label">Time</p>
              <p className="stat-tile-value tabular">5:00</p>
            </div>
          </div>
          <button className="btn btn-primary" onClick={start} style={{ width: '100%' }}>
            Start Test
          </button>
        </div>
      </div>
    );
  }

  if (finished) {
    const correct = answers.filter((a, i) => a === MOCK_QUESTIONS[i].answer).length;
    const total = MOCK_QUESTIONS.length;
    const score = Math.round((correct / total) * 100);
    const passed = score >= 60;

    return (
      <div className="glass panel quiz-summary">
        <h2>{passed ? '✓ Test Complete' : 'Test Complete'}</h2>
        <p style={{ color: 'var(--ink-soft)' }}>JLPT N5 Mock · {MOCK_QUESTIONS.length} questions</p>
        <dl className="summary-rows">
          <div><dt>Score</dt><dd className="tabular" style={{ color: passed ? 'var(--brand-success)' : 'var(--danger)', fontWeight: 700 }}>{score}%</dd></div>
          <div><dt>Correct</dt><dd className="tabular">{correct} of {total}</dd></div>
          <div><dt>Result</dt><dd className="tabular">{passed ? 'Pass' : 'Needs more practice'}</dd></div>
        </dl>

        <div style={{ marginTop: 'var(--s-lg)' }}>
          <h3 style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-caption)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Review</h3>
          {MOCK_QUESTIONS.map((q, i) => {
            const myAnswer = answers[i];
            const isCorrect = myAnswer === q.answer;
            return (
              <div key={i} style={{
                padding: 'var(--s-sm) var(--s-md)',
                marginBottom: 'var(--s-xs)',
                borderLeft: `3px solid ${isCorrect ? 'var(--brand-success)' : 'var(--shu)'}`,
                background: isCorrect ? 'color-mix(in srgb, var(--brand-success) 5%, transparent)' : 'color-mix(in srgb, var(--shu) 5%, transparent)',
                borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                textAlign: 'left',
              }}>
                <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-caption)', marginRight: 'var(--s-sm)' }}>{q.topic}</span>
                <span>{q.question}</span>
                <span style={{ float: 'right', fontSize: 'var(--text-caption)', color: isCorrect ? 'var(--brand-success)' : 'var(--shu)', fontWeight: 600 }}>
                  {isCorrect ? '✓' : `✗ (${q.options[q.answer]})`}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 'var(--s-md)', marginTop: 'var(--s-lg)', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => { setStarted(false); setIndex(0); setAnswers([]); setFinished(false); setSelected(null); setTimeLeft(0); setResultSaved(false); }}>
            Retake test
          </button>
          <Link className="btn btn-secondary" to="/jlpt">Back to JLPT</Link>
        </div>
      </div>
    );
  }

  const q = MOCK_QUESTIONS[index];
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">JLPT N5 Mock Test</h1>
      </header>

      <div className="practice-controls">
        <span className="practice-count tabular" style={{ color: timeLeft < 60 ? 'var(--danger)' : 'var(--ink-soft)' }}>
          ⏱ {mins}:{secs.toString().padStart(2, '0')}
        </span>
        <span className="practice-count tabular">{index + 1} / {MOCK_QUESTIONS.length}</span>
      </div>

      <div className="glass panel" style={{ maxWidth: '560px', margin: '0 auto', padding: 'var(--s-xl)' }}>
        <span className="vocab-tag" style={{ marginBottom: 'var(--s-md)', display: 'inline-block' }}>{q.topic}</span>
        <p className="ja" lang="ja" style={{ fontSize: '1.5rem', marginBottom: 'var(--s-lg)', lineHeight: 1.7 }}>
          {q.question}
        </p>

        <div className="vocab-quiz-options">
          {q.options.map((opt, oi) => {
            let cls = 'vocab-quiz-option';
            if (selected !== null && oi === q.answer) cls += ' vocab-quiz-option-correct';
            if (selected === oi && oi !== q.answer) cls += ' vocab-quiz-option-wrong';
            return (
              <button
                key={oi}
                type="button"
                className={cls}
                onClick={() => { if (selected === null) answer(oi); }}
                disabled={selected !== null}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
