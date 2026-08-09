import { Icon } from '../ui/Icon';

const FEATURES = [
  { icon: 'refresh-cw', title: 'Spaced Repetition', desc: 'FSRS algorithm optimizes your review schedule so you remember what you learn — forever.' },
  { icon: 'bot', title: 'AI Tutor', desc: 'Practice conversations and get real-time feedback from an AI that understands Japanese.' },
  { icon: 'sparkles', title: 'Beautiful Interface', desc: 'A clean, distraction-free design inspired by Japanese aesthetics. Your focus stays on learning.' },
  { icon: 'trending-up', title: 'Progress Tracking', desc: 'Visualize your growth with detailed analytics, heatmaps, and mastery breakdowns.' },
  { icon: 'users', title: 'Community Learning', desc: 'Join leagues, compete with friends, and learn together in a supportive community.' },
  { icon: 'book-open', title: 'Offline Mode', desc: 'Download lessons and practice anywhere — on the train, in a café, or wherever life takes you.' },
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
