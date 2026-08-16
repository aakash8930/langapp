import { Link } from '@tanstack/react-router';

import { inTeachingOrder, type Progress, type Unit } from '../../api';
import { Icon } from '../ui/Icon';

/** Persisted-profile recommendation followed by the next curriculum lessons. */
export function AIRecommendations({ units, progress }: { units: Unit[]; progress: Progress }) {
  const unitOf = new Map<string, Unit>();
  for (const unit of units) {
    for (const lesson of unit.lessons) unitOf.set(lesson.id, unit);
  }

  const completed = new Set(progress.completedLessonIds);
  const recommendedUnit = units.find(
    (unit) => unit.slug === progress.startingRecommendation.unit,
  );
  const recommendedLesson = recommendedUnit?.lessons.find(
    (lesson) => !completed.has(lesson.id),
  );
  const upcoming = inTeachingOrder(units)
    .filter((lesson) => !completed.has(lesson.id) && lesson.id !== recommendedLesson?.id)
    .slice(1, 3);

  if (!recommendedLesson && upcoming.length === 0) return null;

  return (
    <section className="dashboard-section ai-recommendations-card glass" aria-labelledby="recommendations-heading">
      <div className="dashboard-section-head">
        <div>
          <h2 id="recommendations-heading">Recommended for you</h2>
          <small>Rules-based from your stored level and goal — not an AI guess.</small>
        </div>
        <Link to="/courses">View all</Link>
      </div>

      {recommendedUnit ? (
        <div className="recommendation-explanation">
          <strong>{progress.startingRecommendation.title}</strong>
          <p>{progress.startingRecommendation.reason}</p>
          {progress.startingRecommendation.fallback ? (
            <span>Catalog fallback: {progress.startingRecommendation.requestedLevel.toUpperCase()} → N4</span>
          ) : !recommendedLesson ? (
            <span>Profile-matched unit completed</span>
          ) : null}
        </div>
      ) : null}

      <ul className="ai-recommend-list">
        {recommendedLesson ? (
          <li>
            <Link to="/courses" search={{ learn: recommendedLesson.id }}>
              <span className="ai-recommend-icon ai-recommend-icon-1" aria-hidden="true">
                <span className="ja">{recommendedUnit?.ja.slice(0, 1) || '日'}</span>
              </span>
              <span className="ai-recommend-copy">
                <strong>{recommendedLesson.title}</strong>
                <small>{recommendedUnit?.label ?? recommendedLesson.unit} · Profile match</small>
              </span>
              <span className="ai-recommend-action">View</span>
            </Link>
          </li>
        ) : null}

        {upcoming.map((lesson, index) => {
          const unit = unitOf.get(lesson.id);
          return (
            <li key={lesson.id}>
              <Link to="/courses" search={{ learn: lesson.id }}>
                <span className={`ai-recommend-icon ai-recommend-icon-${index + 2}`} aria-hidden="true">
                  {index === 0 ? <Icon name="bot" size={18} /> : <span className="ja">{unit?.ja.slice(0, 1) || '日'}</span>}
                </span>
                <span className="ai-recommend-copy">
                  <strong>{lesson.title}</strong>
                  <small>{unit?.label ?? lesson.unit} · Next in teaching order</small>
                </span>
                <span className="ai-recommend-action">View</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
