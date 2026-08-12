import { Link } from '@tanstack/react-router';

import type { Progress, Unit } from '../../api';

/**
 * The four course tiles in the dashboard reference, backed by real units.
 * Progress is completed lessons over lessons in the unit; no duration, rating,
 * or artwork-specific completion figure is invented.
 */
export function ContinueLearning({ units, progress }: { units: Unit[]; progress: Progress }) {
  const completed = new Set(progress.completedLessonIds);
  const visible = units.slice(0, 4);

  if (visible.length === 0) return null;

  return (
    <section className="dashboard-section continue-learning" aria-labelledby="continue-learning-heading">
      <div className="dashboard-section-head">
        <h2 id="continue-learning-heading">Continue learning</h2>
        <Link to="/courses">View all</Link>
      </div>

      <div className="continue-learning-grid">
        {visible.map((unit, index) => {
          const done = unit.lessons.filter((lesson) => completed.has(lesson.id)).length;
          const total = unit.lessons.length;
          const percent = total > 0 ? Math.round((done / total) * 100) : 0;
          const next = unit.lessons.find((lesson) => !completed.has(lesson.id)) ?? unit.lessons[0];
          const state = percent >= 100 ? 'Complete' : done > 0 ? 'In progress' : index === 0 ? 'Start here' : 'Continue';

          return (
            <Link
              key={unit.slug}
              className={`learning-course learning-course-${(index % 4) + 1}`}
              to="/courses"
              search={{ learn: next?.id ?? undefined }}
            >
              <span className="learning-course-art" aria-hidden="true">
                <span className="learning-course-state">{state}</span>
                <span className="learning-course-ja ja">{unit.ja || '日本語'}</span>
              </span>
              <span className="learning-course-body">
                <strong>{unit.label}</strong>
                <span className="learning-course-count tabular">
                  Lesson {done} of {total}
                </span>
                <span className="learning-course-progress" aria-hidden="true">
                  <span style={{ width: `${percent}%` }} />
                </span>
                <span className="learning-course-percent tabular">{percent}%</span>
              </span>
              <span className="visually-hidden">Open {unit.label}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
