import { Link } from '@tanstack/react-router';

const LEVELS = [
  { level: 'N5', label: 'Beginner', color: 'var(--brand-success)' },
  { level: 'N4', label: 'Elementary', color: 'var(--brand-tertiary)' },
  { level: 'N3', label: 'Intermediate', color: 'var(--brand-primary)' },
  { level: 'N2', label: 'Pre-Advanced', color: 'var(--brand-secondary)' },
  { level: 'N1', label: 'Advanced', color: 'var(--shu)' },
];

export function JLPTPrepSection() {
  return (
    <section className="landing-section" id="jlpt">
      <div className="landing-container">
        <h2 className="landing-heading">JLPT Preparation</h2>
        <p className="landing-subtitle">
          Structured content for every level of the Japanese Language Proficiency Test.
          From N5 basics to N1 mastery.
        </p>
        <div className="jlpt-levels">
          {LEVELS.map((l) => (
            <div key={l.level} className="jlpt-badge" style={{ borderColor: l.color, color: l.color }}>
              <span className="jlpt-level">{l.level}</span>
              <span className="jlpt-label">{l.label}</span>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 'var(--s-lg)' }}>
          <Link className="btn btn-primary" to="/jlpt">
            Explore JLPT Courses
          </Link>
        </div>
      </div>
    </section>
  );
}
