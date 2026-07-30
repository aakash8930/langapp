import { Link } from '@tanstack/react-router';

import { nextUnlearnedLesson, type Progress, type Unit } from '../api';
import { log } from '../debug';

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
 * `/` with `?learn=<id>`, the same destination the end of a lesson uses when the
 * next one has not been learned: it opens that row in the curriculum and scrolls
 * to it. Straight into the quiz would be wrong here — this lesson has not been
 * taught yet, and the row is where the teaching is.
 *
 * **It is a `<Link>`, and that is load-bearing.** This button was a plain
 * `<a href={`#/learn/${id}`}>` until 2026-07-30 and it was broken: `learn` used
 * to be a path segment under the hand-rolled hash router, and the TanStack
 * migration made it a *search param* on `/`. No route matches `/learn/<id>`, so
 * the first thing a new learner ever clicked put them on a bare "Not Found" with
 * an empty console. A typed `<Link to>` would not have compiled. Every
 * navigation in this file goes through one now, and new ones should too.
 */
export function Continue({
  units,
  progress,
}: {
  units: Unit[];
  progress: Progress | null;
}) {
  // Traced because all three of these return `null` — an invisible decision, and
  // "the Continue card is missing" is otherwise indistinguishable from a crash.
  if (!progress || units.length === 0) {
    log('ui', 'Continue: nothing to show', {
      hasProgress: progress !== null,
      unitCount: units.length,
    });
    return null;
  }

  // Cards first. See above — this is the rule, not a layout preference.
  if (progress.cardsDueNow > 0) {
    log('ui', 'Continue: hidden, cards are due', { cardsDueNow: progress.cardsDueNow });
    return null;
  }

  const next = nextUnlearnedLesson(units, progress.completedLessonIds);
  const unit = next ? units.find((u) => u.lessons.some((l) => l.id === next.id)) : null;

  log('ui', 'Continue: next lesson', {
    nextId: next?.id ?? null,
    nextTitle: next?.title ?? null,
    unit: unit?.slug ?? null,
    completedCount: progress.completedLessonIds.length,
    // The destination, spelled out. This is the line that would have made the
    // 2026-07-30 bug a five-second diagnosis.
    to: next ? `/?learn=${next.id}` : null,
  });

  if (!next) {
    return (
      <div className="glass panel continue">
        <div className="continue-body">
          <p className="continue-label">Every lesson done</p>
          <p className="continue-title">
            There is nothing left to unlock — reviews are what keep it now.
          </p>
        </div>
        <Link className="btn btn-primary" to="/review">
          Review
        </Link>
      </div>
    );
  }

  const first = progress.completedLessonIds.length === 0;

  return (
    <div className="glass panel continue">
      <div className="continue-body">
        <p className="continue-label">
          {first ? 'Start here' : 'Pick up here'}
          {unit ? ` · ${unit.label}` : ''}
        </p>
        <p className="continue-title">{next.title}</p>
      </div>
      <Link
        className="btn btn-primary"
        to="/"
        search={{ learn: next.id }}
        onClick={() => log('nav', 'Continue: begin clicked', { lessonId: next.id })}
      >
        {first ? 'Begin' : 'Continue'}
      </Link>
    </div>
  );
}
