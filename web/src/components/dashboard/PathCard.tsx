import { Link } from '@tanstack/react-router';

import type { Progress, Unit } from '../../api';
import { Icon } from '../ui/Icon';

/**
 * The syllabus as a track, unit by unit.
 *
 * ## Every node's figure is counted, and it counts lessons
 *
 * The design's nodes read "46/46", "120/500", "45/200" — item counts. Those are
 * available (`unit.itemCount`), but they measure the wrong thing here: a unit's
 * items include every kana or word it *contains*, whether or not the learner
 * has met them, and there is no per-item mastery figure on `/me/progress` to
 * put over that denominator. `completedLessonIds` is exact, so the fraction is
 * lessons.
 *
 * ## Nothing is locked
 *
 * The design shows a padlock on the last node. The API does not gate browsing —
 * `GET /lessons` is public and the curriculum renders every row — so a lock
 * drawn here would be a rule the product does not have, and one a learner could
 * disprove by clicking through to the unit. Units the learner has not reached
 * are simply "not started".
 *
 * That is a smaller claim than the design makes, and the honest one:
 * prerequisites *do* exist on the wire (`prerequisiteLessonIds`), but they gate
 * teaching order rather than access.
 */
export function PathCard({ units, progress }: { units: Unit[]; progress: Progress }) {
  if (units.length === 0) return null;

  const completed = new Set(progress.completedLessonIds);

  const nodes = units.map((unit) => {
    const done = unit.lessons.filter((lesson) => completed.has(lesson.id)).length;
    const total = unit.lessons.length;

    return {
      unit,
      done,
      total,
      state: done === 0 ? 'todo' : done >= total ? 'done' : 'doing',
    } as const;
  });

  return (
    <section className="card path-card glass" aria-labelledby="path-heading">
      <div className="card-head">
        <h2 className="card-title" id="path-heading">
          Your learning path
        </h2>
        <Link className="btn btn-secondary btn-sm" to="/courses">
          View full path
        </Link>
      </div>

      <ol className="path-row">
        {nodes.map((node) => (
          <li className={`path-node path-node-${node.state}`} key={node.unit.slug}>
            {/*
              The connector is drawn on the node rather than between nodes so it
              scrolls with them, and it is `aria-hidden` because a list already
              says these are in sequence.
            */}
            <span className="path-track" aria-hidden="true" />

            <Link className="path-dot" to="/courses" aria-label={`${node.unit.label} — open in the curriculum`}>
              {node.state === 'done' ? (
                <Icon name="check" size={18} />
              ) : (
                <span className="ja" aria-hidden="true">
                  {node.unit.ja.slice(0, 2) || '—'}
                </span>
              )}
            </Link>

            <span className="path-label">{node.unit.label}</span>
            <span className="path-count tabular">
              {node.done} / {node.total}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
