import { Link } from '@tanstack/react-router';

export function AIToolsHub() {
  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">AI Tools</h1>
        <p className="page-sub">AI-powered practice, feedback, and learning assistants.</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--s-lg)' }}>
        <Link className="glass panel" to="/speaking-conversation" search={{ session: undefined }} style={{ padding: 'var(--s-xl)', textDecoration: 'none' }}>
          <div style={{ fontSize: '2rem', marginBottom: 'var(--s-sm)' }}>🤖</div>
          <strong style={{ display: 'block', marginBottom: 'var(--s-xs)', fontSize: 'var(--text-large)' }}>AI Conversation</strong>
          <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-small)' }}>
            Meet an AI conversation partner in the real first-meeting scenario and receive grammar and vocabulary corrections.
          </span>
        </Link>

        <Link className="glass panel" to="/speaking-pronunciation" style={{ padding: 'var(--s-xl)', textDecoration: 'none' }}>
          <div style={{ fontSize: '2rem', marginBottom: 'var(--s-sm)' }}>🎤</div>
          <strong style={{ display: 'block', marginBottom: 'var(--s-xs)', fontSize: 'var(--text-large)' }}>Pronunciation Practice</strong>
          <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-small)' }}>
            Hear course readings, record your voice, and compare the browser transcript without a fabricated accent score.
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

        <Link className="glass panel" to="/writing-feedback" style={{ padding: 'var(--s-xl)', textDecoration: 'none' }}>
          <div style={{ fontSize: '2rem', marginBottom: 'var(--s-sm)' }}>✍️</div>
          <strong style={{ display: 'block', marginBottom: 'var(--s-xs)', fontSize: 'var(--text-large)' }}>Writing Feedback</strong>
          <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-small)' }}>
            Submit saved Japanese writing for teaching-focused feedback and exact corrections without a synthetic score.
          </span>
        </Link>
      </div>

      <div className="glass panel" style={{ marginTop: 'var(--s-xl)', padding: 'var(--s-lg)', textAlign: 'center', maxWidth: '600px', margin: 'var(--s-xl) auto 0' }}>
        <p className="card-note" style={{ margin: 0 }}>
          Conversation tools use the tutor chat. Writing Feedback uses the same correction pipeline through a dedicated review scenario, so matching corrected course words can feed the existing review system.
        </p>
        <Link className="btn btn-primary" to="/speaking-conversation" search={{ session: undefined }} style={{ marginTop: 'var(--s-md)' }}>
          Start AI Chat
        </Link>
      </div>
    </div>
  );
}
