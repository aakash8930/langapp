import { Link } from '@tanstack/react-router';

import type { Progress, Unit } from '../../api';
import { Icon } from '../ui/Icon';

/** N5 course completion presented in the exam card slot from the reference. */
export function JLPTPanel({ units, progress }: { units: Unit[]; progress: Progress }) {
  const lessons = units.flatMap((unit) => unit.lessons);
  const completed = new Set(progress.completedLessonIds);
  const done = lessons.filter((lesson) => completed.has(lesson.id)).length;
  const percent = lessons.length > 0 ? Math.round((done / lessons.length) * 100) : 0;

  return (
    <section className="card jlpt-card glass" aria-labelledby="jlpt-heading">
      <div className="dashboard-section-head">
        <h2 id="jlpt-heading">JLPT preparation</h2>
      </div>
      <div className="jlpt-track-row">
        <span className="jlpt-shield" aria-hidden="true">N5</span>
        <span className="jlpt-track-copy">
          <strong>Beginner track</strong>
          <small className="tabular">{done} of {lessons.length} lessons</small>
        </span>
        <Icon name="graduation-cap" size={24} />
      </div>
      <span className="jlpt-progress" aria-hidden="true"><span style={{ width: `${percent}%` }} /></span>
      <p className="jlpt-progress-note"><span>Your progress</span><strong className="tabular">{percent}%</strong></p>
      <Link className="dashboard-outline-action" to="/jlpt">
        Go to JLPT hub <Icon name="chevron-right" size={14} />
      </Link>
    </section>
  );
}
