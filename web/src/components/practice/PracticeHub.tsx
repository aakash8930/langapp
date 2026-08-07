import { Link } from '@tanstack/react-router';

export function PracticeHub() {
  const modes = [
    { to: '/review' as const, label: 'SRS Review', icon: '🔄', desc: 'Spaced repetition — grade the cards you\'re due to review.' },
    { to: '/mixed-practice' as const, label: 'Mixed Practice', icon: '🎯', desc: 'Random questions from vocab, kanji, and grammar.' },
    { to: '/vocab-practice' as const, label: 'Vocab Quiz', icon: '📝', desc: 'Multiple-choice quiz on your vocabulary words.' },
    { to: '/hiragana-flashcards' as const, label: 'Kana Flashcards', icon: '🃏', desc: 'Flip-and-grade for hiragana and katakana.' },
    { to: '/sentence-builder' as const, label: 'Sentence Builder', icon: '🧱', desc: 'Arrange tokens into correct Japanese sentences.' },
    { to: '/speaking' as const, label: 'Speaking', icon: '🎤', desc: 'Practice pronunciation with speech recognition.' },
    { to: '/kanji-writing' as const, label: 'Kanji Writing', icon: '✍️', desc: 'Trace kanji stroke by stroke.' },
    { to: '/practice' as const, label: 'AI Tutor', icon: '🤖', desc: 'Chat with an AI shopkeeper in Japanese.' },
  ];

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">Practice Hub</h1>
        <p className="page-sub">Choose a practice mode to strengthen your skills.</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--s-lg)' }}>
        {modes.map((m) => (
          <Link key={m.to} className="glass panel" to={m.to} style={{ padding: 'var(--s-xl)', textDecoration: 'none', transition: 'transform var(--t-fast) ease' }}>
            <div style={{ fontSize: '2rem', marginBottom: 'var(--s-sm)' }}>{m.icon}</div>
            <strong style={{ color: 'var(--ink)', display: 'block', marginBottom: 'var(--s-xs)', fontSize: 'var(--text-large)' }}>
              {m.label}
            </strong>
            <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-small)', lineHeight: 1.5 }}>
              {m.desc}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
