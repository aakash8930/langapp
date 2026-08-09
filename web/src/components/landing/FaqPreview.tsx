import { Link } from '@tanstack/react-router';

const FAQS = [
  { q: 'Is GENKŌ really free?', a: 'Yes! The Free plan gives you access to core lessons, vocabulary, kanji, and grammar. Pro unlocks unlimited lessons, AI Tutor, and advanced analytics.' },
  { q: 'Do I need to know any Japanese to start?', a: 'Not at all. GENKŌ starts from absolute zero — hiragana, katakana, and basic vocabulary. Our placement test can also fast-track you if you already know some.' },
  { q: 'How does spaced repetition work?', a: 'GENKŌ uses the FSRS algorithm to schedule your reviews. Cards you find easy appear less often; cards you struggle with come back sooner. This optimizes your memory retention.' },
  { q: 'Can I study offline?', a: 'Pro subscribers can download lessons for offline use. Study on the train, in a café, or anywhere without internet.' },
  { q: 'What is JLPT and does GENKŌ help with it?', a: 'JLPT is the Japanese Language Proficiency Test — the standard certification. GENKŌ has structured content aligned with N5 through N1 levels, plus mock tests and targeted practice.' },
];

export function FaqPreview() {
  return (
    <section className="landing-section landing-section--alt" id="faq">
      <div className="landing-container">
        <h2 className="landing-heading">Frequently asked questions</h2>
        <div className="faq-list">
          {FAQS.map((faq) => (
            <details key={faq.q} className="faq-item">
              <summary className="faq-question">{faq.q}</summary>
              <p className="faq-answer">{faq.a}</p>
            </details>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 'var(--s-lg)' }}>
          <Link className="btn btn-secondary" to="/faq">View all FAQs</Link>
        </div>
      </div>
    </section>
  );
}
