import { Link } from '@tanstack/react-router';

const FAQS = [
  { q: 'Is GENKŌ really free?', a: 'Yes. Every feature released in the public MVP is free, with no payment card or trial expiry. Paid checkout is disabled.' },
  { q: 'Do I need to know any Japanese to start?', a: 'Not at all. GENKŌ starts from absolute zero with hiragana, katakana, and basic vocabulary. Onboarding can also recommend a later starting unit if you already know some Japanese.' },
  { q: 'How are lessons structured?', a: 'Each lesson introduces a small set of concepts, checks recognition and recall, and records completion only after every exercise is answered correctly.' },
  { q: 'Can I study offline?', a: 'Not yet. Lessons, account sync, exercises, and AI currently require a connection.' },
  { q: 'What JLPT content is available?', a: 'The authored course currently contains beginner, N5, and N4-aligned vocabulary, grammar, and kanji. Higher-level onboarding choices explicitly fall back to the highest available N4 material.' },
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
