import { Link } from '@tanstack/react-router';

import { inTeachingOrder, type Progress, type Unit } from '../../api';
import { Icon } from '../ui/Icon';

/** Next lessons in teaching order, derived from the curriculum and progress. */
export function AIRecommendations({ units, progress }: { units: Unit[]; progress: Progress }) {
  const unitOf = new Map<string, Unit>();
  for (const unit of units) {
    for (const lesson of unit.lessons) unitOf.set(lesson.id, unit);
  }

  const completed = new Set(progress.completedLessonIds);
  const upcoming = inTeachingOrder(units)
    .filter((lesson) => !completed.has(lesson.id))
    .slice(1, 4);

  if (upcoming.length === 0) return null;

  return (
    <section className="dashboard-section ai-recommendations-card glass" aria-labelledby="ai-recommendations-heading">
      <div className="dashboard-section-head">
        <h2 id="ai-recommendations-heading">AI recommendations</h2>
        <Link to="/courses">View all</Link>
      </div>

      <ul className="ai-recommend-list">
        {upcoming.map((lesson, index) => {
          const unit = unitOf.get(lesson.id);
          return (
            <li key={lesson.id}>
              <Link to="/courses" search={{ learn: lesson.id }}>
                <span className={`ai-recommend-icon ai-recommend-icon-${index + 1}`} aria-hidden="true">
                  {index === 1 ? <Icon name="bot" size={18} /> : <span className="ja">{unit?.ja.slice(0, 1) || '日'}</span>}
                </span>
                <span className="ai-recommend-copy">
                  <strong>{lesson.title}</strong>
                  <small>{unit?.label ?? lesson.unit} · {lesson.itemCount} items</small>
                </span>
                <span className="ai-recommend-action">Start</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
