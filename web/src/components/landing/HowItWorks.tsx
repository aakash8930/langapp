import { Icon } from '../ui/Icon';

const STEPS = [
  { step: 1, icon: 'book-open', title: 'Choose a Course', desc: 'Start with Hiragana, Katakana, or jump into vocabulary and grammar.' },
  { step: 2, icon: 'pen-square', title: 'Practise Immediately', desc: 'Recognition and recall exercises reinforce each concept before the lesson is complete.' },
  { step: 3, icon: 'trending-up', title: 'Track Your Progress', desc: 'Watch your streak grow, earn achievements, and climb the league ranks.' },
] as const;

export function HowItWorks() {
  return (
    <section className="landing-section landing-section--alt" id="how-it-works">
      <div className="landing-container">
        <h2 className="landing-heading">How it works</h2>
        <p className="landing-subtitle">Three steps from your first kana to reading real Japanese.</p>
        <div className="steps-grid">
          {STEPS.map((s) => (
            <div key={s.step} className="step-card">
              <div className="step-number">{s.step}</div>
              <div className="step-icon">
                <Icon name={s.icon as any} size={28} />
              </div>
              <h3 className="step-title">{s.title}</h3>
              <p className="step-desc">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
