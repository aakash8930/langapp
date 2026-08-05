import { Link } from '@tanstack/react-router';

import { nextUnlearnedLesson, type Progress, type Unit } from '../../api';
import { log } from '../../debug';
import { Icon } from '../ui/Icon';

/**
 * "You are here" — the first lesson not yet completed, and the way straight to
 * it. The dashboard's primary action.
 *
 * ## It stands down while cards are due
 *
 * The due-reviews panel is the loudest thing on this screen when it has
 * anything in it, because SRS only works if due cards get cleared before new
 * material is added. A second tempting call to action beside it would undo
 * exactly that, so this one says so and points at the reviews instead. That is
 * the site's existing rule (see `Continue.tsx`, which this card replaces on the
 * dashboard), not a new one.
 *
 * ## The progress figure is the unit's, and it is counted here
 *
 * The design's "65% Complete" sits under a course title, so this counts
 * completed lessons in the unit the next lesson belongs to. That is arithmetic
 * over two things the API already sent — the unit's lesson list and
 * `completedLessonIds` — rather than a number invented to fill the bar.
 *
 * ## Where it points
 *
 * `/courses?learn=<id>`, the same destination the end of a lesson uses when the
 * next one has not been learned: it opens that row in the curriculum and
 * scrolls to it. Straight into the quiz would be wrong — this lesson has not
 * been taught yet, and the row is where the teaching is.
 */
export function ContinueCard({
  units,
  progress,
}: {
  units: Unit[];
  progress: Progress;
}) {
  if (units.length === 0) {
    // Traced because it renders nothing, and "the Continue card is missing" is
    // otherwise indistinguishable from a crash.
    log('ui', 'ContinueCard: no units loaded');
    return null;
  }

  if (progress.cardsDueNow > 0) {
    return (
      <section className="card continue-card glass" aria-labelledby="continue-heading">
        <h2 className="card-title" id="continue-heading">
          Reviews first
        </h2>
        <p className="continue-lead">
          {progress.cardsDueNow} {progress.cardsDueNow === 1 ? 'card is' : 'cards are'} due. Spaced
          repetition only works if these get cleared before something new goes on top.
        </p>
        <Link className="btn btn-primary" to="/review">
          Start reviewing
        </Link>
      </section>
    );
  }

  const next = nextUnlearnedLesson(units, progress.completedLessonIds);

  if (!next) {
    return (
      <section className="card continue-card glass" aria-labelledby="continue-heading">
        <h2 className="card-title" id="continue-heading">
          Every lesson done
        </h2>
        <p className="continue-lead">
          There is nothing left to unlock — reviews are what keep it now.
        </p>
        <Link className="btn btn-secondary" to="/review">
          Review
        </Link>
      </section>
    );
  }

  const unit = units.find((candidate) => candidate.lessons.some((l) => l.id === next.id)) ?? null;
  const doneInUnit =
    unit?.lessons.filter((lesson) => progress.completedLessonIds.includes(lesson.id)).length ?? 0;
  const totalInUnit = unit?.lessons.length ?? 0;
  const percent = totalInUnit > 0 ? Math.round((doneInUnit / totalInUnit) * 100) : 0;

  const first = progress.completedLessonIds.length === 0;

  return (
    <section className="card continue-card glass" aria-labelledby="continue-heading">
      <h2 className="card-title" id="continue-heading">
        Continue learning
      </h2>

      <div className="continue-row">
        {/*
          The design puts a video thumbnail here. There is no video in this
          product and no lesson artwork on the wire, so the slot holds the
          unit's Japanese name instead — which is at least a picture of the
          thing being learned. A stock photograph would also have broken the
          contrast guarantee the glass panels depend on (see CLAUDE.md: nothing
          behind glass may become a photograph).
        */}
        <span className="continue-plate" aria-hidden="true">
          <span className="ja">{unit?.ja || '日本語'}</span>
        </span>

        <div className="continue-detail">
          <p className="continue-unit">{unit?.label ?? 'Course'}</p>
          <p className="continue-lesson">{next.title}</p>

          {totalInUnit > 0 ? (
            <>
              <span className="continue-bar" aria-hidden="true">
                <span className="continue-bar-fill" style={{ width: `${percent}%` }} />
              </span>
              <p className="continue-bar-note tabular">
                {doneInUnit} / {totalInUnit} lessons in this unit
              </p>
            </>
          ) : null}
        </div>
      </div>

      <Link
        className="btn btn-primary continue-go"
        to="/courses"
        search={{ learn: next.id }}
        onClick={() => log('nav', 'dashboard: continue clicked', { lessonId: next.id })}
      >
        {first ? 'Begin' : 'Continue'}
        <Icon name="chevron-right" size={18} />
      </Link>
    </section>
  );
}
