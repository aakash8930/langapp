import { Icon } from '../ui/Icon';

/**
 * Study time today — placeholder.
 *
 * ## Why no number
 *
 * Nothing records the duration of a study session. There is no clock-on /
 * clock-off in the API and no aggregate endpoint that would let the server
 * compute it after the fact, so any minute count rendered here would be a
 * number the learner would have to take on faith — exactly the kind of
 * derived-but-not-derived figure `TodayCard`'s JSDoc rules out for Study
 * Time.
 */
export function StudyTime() {
  return (
    <section className="card study-time-card glass" aria-labelledby="study-time-heading">
      <div className="placeholder-head">
        <h2 className="card-title" id="study-time-heading">
          <span className="card-title-icon" aria-hidden="true">
            <Icon name="zap" size={18} />
          </span>
          Study time today
        </h2>
        <span className="placeholder-pill">Coming soon</span>
      </div>
      <p className="placeholder-note">Session duration is not recorded yet.</p>
    </section>
  );
}