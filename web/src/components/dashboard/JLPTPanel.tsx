import { Icon } from '../ui/Icon';

/**
 * JLPT readiness — placeholder.
 *
 * ## Why no readiness figure
 *
 * Every levelled item in the corpus is N5 right now (a single axis), and
 * there is no per-item mastery endpoint that would let the server say how
 * much of that level a learner has actually covered. A bar labelled
 * "JLPT N5 — 24%" would be a denominator nobody set, which is the same
 * silent-target failure the TodayCard JSDoc writes down.
 */
export function JLPTPanel() {
  return (
    <section className="card jlpt-card glass" aria-labelledby="jlpt-heading">
      <div className="placeholder-head">
        <h2 className="card-title" id="jlpt-heading">
          <span className="card-title-icon" aria-hidden="true">
            <Icon name="graduation-cap" size={18} />
          </span>
          JLPT readiness
        </h2>
        <span className="placeholder-pill">Coming soon</span>
      </div>
      <p className="placeholder-note">
        Every levelled item in the corpus is N5 right now, and no per-item
        mastery endpoint exists to compute a readiness figure.
      </p>
    </section>
  );
}