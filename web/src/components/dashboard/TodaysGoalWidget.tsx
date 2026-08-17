import type { Progress } from '../../api';

/**
 * Today's goal — the same ring as `TodayCard`, in a smaller side-panel
 * form so the design's quick-glance figure is one click / one scroll away
 * from the full dial.
 *
 * ## Sharing the ring styles
 *
 * Reuses `.today-ring` / `.today-ring-track` / `.today-ring-fill` from the
 * main card. The class `.todays-goal-dial` only resizes the SVG box; the
 * percentages (`pathLength="100"` + dash-array) are unchanged.
 *
 * The duplication is the design's, not something to deduplicate — the
 * main card carries the figure large, the side card carries it as a
 * compact status, and they should never go out of sync because both pull
 * from the same `daily.percentOfGoal`.
 */
function Ring({ percent }: { percent: number }) {
  const filled = Math.max(0, Math.min(percent, 100));

  return (
    <svg className="today-ring todays-goal-dial" viewBox="0 0 100 100" aria-hidden="true">
      <circle className="today-ring-track" cx="50" cy="50" r="42" pathLength={100} />
      <circle
        className="today-ring-fill"
        cx="50"
        cy="50"
        r="42"
        pathLength={100}
        strokeDasharray={`${filled} ${100 - filled}`}
      />
    </svg>
  );
}

export function TodaysGoalWidget({ progress }: { progress: Progress }) {
  const { daily } = progress;

  return (
    <section className="card todays-goal-card glass" aria-labelledby="todays-goal-heading">
      <h2 className="card-title" id="todays-goal-heading">
        Today&rsquo;s goal
      </h2>
      <div className="todays-goal-body">
        <div className="today-dial">
          <Ring percent={daily.percentOfGoal} />
          <p className="today-dial-figure tabular">
            {Math.round(daily.percentOfGoal)}%<span>Daily goal</span>
          </p>
        </div>
        <p className="todays-goal-meta tabular">
          <span>Daily goal</span>
          <strong>{daily.xpToday} <small>/ {daily.goalXp} XP</small></strong>
          <em>{daily.goalMet ? 'Goal complete!' : 'Keep going — you are getting closer.'}</em>
        </p>
      </div>
      <span className="goal-accent-bar" aria-hidden="true"><span style={{ width: `${Math.min(daily.percentOfGoal, 100)}%` }} /></span>
      <dl className="goal-mini-stats">
        <div><dt>Lessons</dt><dd className="tabular">{daily.lessonsDone}</dd></div>
      </dl>
    </section>
  );
}