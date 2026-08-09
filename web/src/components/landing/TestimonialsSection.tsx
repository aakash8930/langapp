const TESTIMONIALS = [
  { name: 'Yuki T.', role: 'N3 Learner', quote: 'GENKŌ\'s spaced repetition completely changed how I study. I went from forgetting everything after a week to retaining kanji I learned months ago.', avatar: 'YT' },
  { name: 'Marcus L.', role: 'N5 Beginner', quote: 'I tried Duolingo, Anki, and textbooks. GENKŌ is the first app that actually made me excited to study Japanese every day.', avatar: 'ML' },
  { name: 'Priya S.', role: 'N2 Advanced', quote: 'The AI tutor is incredible. Having real conversations and getting corrections in real-time is something no textbook can do.', avatar: 'PS' },
];

export function TestimonialsSection() {
  return (
    <section className="landing-section" id="testimonials">
      <div className="landing-container">
        <h2 className="landing-heading">What learners say</h2>
        <p className="landing-subtitle">Join thousands of learners who have made real progress with GENKŌ.</p>
        <div className="testimonials-grid">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="testimonial-card glass">
              <div className="testimonial-avatar">{t.avatar}</div>
              <blockquote className="testimonial-quote">"{t.quote}"</blockquote>
              <div className="testimonial-author">
                <strong>{t.name}</strong>
                <span>{t.role}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
