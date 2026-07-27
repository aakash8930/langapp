import { nextUnlearnedLesson, type Progress, type Unit } from '../api';

/**
 * "You are here" — the first lesson not yet completed, and a way straight to it.
 *
 * The home page is a six-unit syllabus, and the one thing a returning learner
 * actually wants from it is the row they stopped at. Without this the page
 * answers "what does this course contain" and leaves "what do I do now" to be
 * solved by scrolling.
 *
 * ## Deliberately absent while cards are due
 *
 * The due-cards callout is the loudest thing on the page when it is there,
 * because SRS only works if due cards get cleared before new material is added.
 * Putting a second tempting call to action beside it would undo exactly that —
 * so this one waits its turn. That is the site's existing rule, not a new one.
 *
 * ## Where it points
 *
 * `#/learn/<id>`, the same route the end of a lesson uses when the next one has
 * not been learned: it opens that row in the curriculum and scrolls to it.
 * Straight into the quiz would be wrong here — this lesson has not been taught
 * yet, and the row is where the teaching is.
 */
export function Continue({
  units,
  progress,
}: {
  units: Unit[];
  progress: Progress | null;
}) {
  if (!progress || units.length === 0) return null;

  // Cards first. See above — this is the rule, not a layout preference.
  if (progress.cardsDueNow > 0) return null;

  const next = nextUnlearnedLesson(units, progress.completedLessonIds);
  const unit = next ? units.find((u) => u.lessons.some((l) => l.id === next.id)) : null;

  if (!next) {
    return (
      <div className="glass panel continue">
        <div className="continue-body">
          <p className="continue-label">Every lesson done</p>
          <p className="continue-title">
            There is nothing left to unlock — reviews are what keep it now.
          </p>
        </div>
        <a className="button" href="#/review">
          Review
        </a>
      </div>
    );
  }

  return (
    <div className="glass panel continue">
      <div className="continue-body">
        <p className="continue-label">
          {progress.completedLessonIds.length === 0 ? 'Start here' : 'Pick up here'}
          {unit ? ` · ${unit.label}` : ''}
        </p>
        <p className="continue-title">{next.title}</p>
      </div>
      <a className="button" href={`#/learn/${next.id}`}>
        {progress.completedLessonIds.length === 0 ? 'Begin' : 'Continue'}
      </a>
    </div>
  );
}
