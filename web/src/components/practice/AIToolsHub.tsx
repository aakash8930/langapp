import { Link } from '@tanstack/react-router';

export function AIToolsHub() {
  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">AI Tools</h1>
        <p className="page-sub">AI-powered practice, feedback, and learning assistants.</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--s-lg)' }}>
        <Link className="glass panel" to="/practice" style={{ padding: 'var(--s-xl)', textDecoration: 'none' }}>
          <div style={{ fontSize: '2rem', marginBottom: 'var(--s-sm)' }}>🤖</div>
          <strong style={{ display: 'block', marginBottom: 'var(--s-xs)', fontSize: 'var(--text-large)' }}>AI Conversation</strong>
          <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-small)' }}>
            Chat with an AI shopkeeper in Japanese. Get real-time corrections on your grammar and vocabulary.
          </span>
        </Link>

        <Link className="glass panel" to="/speaking" style={{ padding: 'var(--s-xl)', textDecoration: 'none' }}>
          <div style={{ fontSize: '2rem', marginBottom: 'var(--s-sm)' }}>🎤</div>
          <strong style={{ display: 'block', marginBottom: 'var(--s-xs)', fontSize: 'var(--text-large)' }}>Pronunciation Practice</strong>
          <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-small)' }}>
            Read words aloud and get speech recognition feedback. Practice your accent.
          </span>
        </Link>

        <div className="glass panel" style={{ padding: 'var(--s-xl)', opacity: 0.6 }}>
          <div style={{ fontSize: '2rem', marginBottom: 'var(--s-sm)' }}>🔍</div>
          <strong style={{ display: 'block', marginBottom: 'var(--s-xs)', fontSize: 'var(--text-large)' }}>Grammar Checker</strong>
          <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-small)' }}>
            Built into AI Conversation — every message is checked for grammar mistakes with corrections.
          </span>
          <span className="placeholder-pill" style={{ display: 'inline-block', marginTop: 'var(--s-sm)', fontSize: 'var(--text-caption)', color: 'var(--ink-soft)' }}>
            Available in Chat
          </span>
        </div>

        <div className="glass panel" style={{ padding: 'var(--s-xl)', opacity: 0.6 }}>
          <div style={{ fontSize: '2rem', marginBottom: 'var(--s-sm)' }}>📖</div>
          <strong style={{ display: 'block', marginBottom: 'var(--s-xs)', fontSize: 'var(--text-large)' }}>Sentence Explainer</strong>
          <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-small)' }}>
            Ask the AI tutor to break down any sentence — it explains grammar, particles, and word usage inline.
          </span>
          <span className="placeholder-pill" style={{ display: 'inline-block', marginTop: 'var(--s-sm)', fontSize: 'var(--text-caption)', color: 'var(--ink-soft)' }}>
            Available in Chat
          </span>
        </div>

        <div className="glass panel" style={{ padding: 'var(--s-xl)', opacity: 0.6 }}>
          <div style={{ fontSize: '2rem', marginBottom: 'var(--s-sm)' }}>🌐</div>
          <strong style={{ display: 'block', marginBottom: 'var(--s-xs)', fontSize: 'var(--text-large)' }}>Translation</strong>
          <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-small)' }}>
            Type a word or sentence and the AI translates it. Paste anything you want help understanding.
          </span>
          <span className="placeholder-pill" style={{ display: 'inline-block', marginTop: 'var(--s-sm)', fontSize: 'var(--text-caption)', color: 'var(--ink-soft)' }}>
            Available in Chat
          </span>
        </div>

        <div className="glass panel" style={{ padding: 'var(--s-xl)', opacity: 0.6 }}>
          <div style={{ fontSize: '2rem', marginBottom: 'var(--s-sm)' }}>✍️</div>
          <strong style={{ display: 'block', marginBottom: 'var(--s-xs)', fontSize: 'var(--text-large)' }}>Writing Feedback</strong>
          <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-small)' }}>
            Write sentences in Japanese and the AI corrects your grammar, word choice, and style.
          </span>
          <span className="placeholder-pill" style={{ display: 'inline-block', marginTop: 'var(--s-sm)', fontSize: 'var(--text-caption)', color: 'var(--ink-soft)' }}>
            Available in Chat
          </span>
        </div>
      </div>

      <div className="glass panel" style={{ marginTop: 'var(--s-xl)', padding: 'var(--s-lg)', textAlign: 'center', maxWidth: '600px', margin: 'var(--s-xl) auto 0' }}>
        <p className="card-note" style={{ margin: 0 }}>
          All AI tools are powered by the same conversation engine. Start a chat to access grammar checking, translation, sentence explanation, and writing feedback — just ask!
        </p>
        <Link className="btn btn-primary" to="/practice" style={{ marginTop: 'var(--s-md)' }}>
          Start AI Chat
        </Link>
      </div>
    </div>
  );
}
