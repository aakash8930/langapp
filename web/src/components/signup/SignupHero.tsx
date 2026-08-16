import { BookOpenCheck, Flame, Repeat2, Smartphone } from 'lucide-react';

function SakuraPetal({ className }: { className: string }) {
  return (
    <svg className={`signup-deco ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2c2 4 8 8 8 14 0 3-4 6-8 6s-8-3-8-6c0-6 6-10 8-14z" fill="currentColor" />
    </svg>
  );
}

const BENEFITS = [
  {
    icon: BookOpenCheck,
    title: 'A clear path from kana to JLPT',
    text: 'Follow structured lessons instead of guessing what to study next.',
  },
  {
    icon: Repeat2,
    title: 'Review at the right time',
    text: 'Completed lessons feed a spaced-review queue tied to your account.',
  },
  {
    icon: Smartphone,
    title: 'Keep progress across devices',
    text: 'Your XP, streak, lessons, and reviews stay with the same profile.',
  },
] as const;

/** Product context for signup: useful outcomes, not decorative auth wallpaper. */
export function SignupHero() {
  return (
    <aside className="signup-hero" aria-labelledby="signup-hero-title">
      <div className="signup-hero-overlay" aria-hidden="true" />
      <div className="signup-hero-glow" aria-hidden="true" />
      <SakuraPetal className="signup-deco--petal-1" />
      <SakuraPetal className="signup-deco--petal-2" />
      <SakuraPetal className="signup-deco--petal-3" />
      <SakuraPetal className="signup-deco--petal-4" />

      <div className="signup-hero-content">
        <div className="signup-hero-copy">
          <p className="signup-hero-eyebrow"><span lang="ja">日本語</span> · BUILT FOR CONSISTENT STUDY</p>
          <h2 id="signup-hero-title">
            Small lessons.<br />A habit that <em>sticks.</em>
          </h2>
          <p className="signup-hero-intro">
            Learn Japanese with focused practice, account-backed review, and progress you can actually see.
          </p>

          <ul className="signup-benefits">
            {BENEFITS.map(({ icon: Icon, title, text }) => (
              <li key={title}>
                <span className="signup-benefit-icon"><Icon size={20} aria-hidden="true" /></span>
                <span><strong>{title}</strong><small>{text}</small></span>
              </li>
            ))}
          </ul>
        </div>

        <div className="signup-learning-card" aria-label="Example daily learning plan">
          <div className="signup-learning-card-head">
            <span><i aria-hidden="true" /> TODAY'S START</span>
            <span className="signup-learning-time">10 min</span>
          </div>
          <div className="signup-learning-lesson">
            <span className="signup-kana" lang="ja">あ</span>
            <span><strong>Hiragana foundations</strong><small>Recognize, hear, and write your first characters</small></span>
          </div>
          <div className="signup-learning-progress">
            <span><i className="is-done" /><i /><i /></span>
            <small>Lesson 1 of 3</small>
          </div>
          <div className="signup-learning-streak">
            <Flame size={17} aria-hidden="true" />
            <span><strong>Start a streak today</strong><small>Consistency beats cramming.</small></span>
          </div>
        </div>
      </div>
    </aside>
  );
}
