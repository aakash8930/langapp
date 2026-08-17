import { Icon } from '../ui/Icon';

const FEATURES = [
  { icon: 'book-open', title: 'Guided Lessons', desc: 'Learn a small set of concepts, practise them immediately, and move through one ordered course.' },
  { icon: 'bot', title: 'AI Tutor', desc: 'Practice conversations and get real-time feedback from an AI that understands Japanese.' },
  { icon: 'book-open', title: 'Structured Courses', desc: 'Move from kana through vocabulary, grammar, and kanji in one prerequisite-aware path.' },
  { icon: 'trending-up', title: 'Progress Tracking', desc: 'See completed lessons, checkpoints, XP, and streak data from your synced account.' },
  { icon: 'headphones', title: 'Japanese Audio', desc: 'Hear course readings from generated recordings with a system-voice fallback when needed.' },
  { icon: 'languages', title: 'Web and Android', desc: 'Continue the same lessons and progress across the browser and Android app.' },
] as const;

export function FeaturesSection() {
  return (
    <section className="landing-section" id="features">
      <div className="landing-container">
        <h2 className="landing-heading">Everything you need to master Japanese</h2>
        <p className="landing-subtitle">Tools built by learners, for learners. No gimmicks — just effective study.</p>
        <div className="features-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="feature-card glass">
              <div className="feature-icon">
                <Icon name={f.icon as any} size={24} />
              </div>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
