import { Link } from '@tanstack/react-router';

import type { Progress, Unit } from '../../api';
import { Icon } from '../ui/Icon';

/**
 * The last few completed lessons, derived from `completedLessonIds`.
 *
 * Shows lessons in reverse teaching order (most recent first), capped at 4.
 * Everything here comes from the existing data on the wire — no timeline
 * endpoint needed.
 */
export function RecentLessons({ units, progress }: { units: Unit[]; progress: Progress }) {
  const completed = new Set(progress.completedLessonIds);
  const recent = units
    .flatMap((unit) =>
      unit.lessons
        .filter((lesson) => completed.has(lesson.id))
        .map((lesson) => ({ lesson, unit })),
    )
    .reverse()
    .slice(0, 4);

  if (recent.length === 0) return null;

  return (
    <section className="card glass" aria-labelledby="recent-lessons-heading">
      <div className="card-head">
        <h2 className="card-title" id="recent-lessons-heading">
          Recent activity
        </h2>
        <Link className="card-link" to="/courses">
          View all
        </Link>
      </div>

      <ul className="review-list">
        {recent.map(({ lesson, unit }) => (
          <li className="review-row" key={lesson.id}>
            <span className="review-glyph ja" aria-hidden="true">
              {unit.ja.slice(0, 2) || '—'}
            </span>
            <span className="review-body">
              <span className="review-label">{lesson.title}</span>
              <span className="review-kind">{unit.label}</span>
            </span>
            <span className="review-wait" aria-hidden="true">
              <Icon name="check" size={14} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
