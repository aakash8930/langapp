import type { Progress } from '../../api';
import { Icon } from '../ui/Icon';

/**
 * The ring. Drawn as an SVG rather than a conic gradient because a gradient
 * cannot be given a rounded cap, and the design's ring has one.
 *
 * `pathLength` normalises the circumference to 100, so the dash array is the
 * percentage directly and nobody has to recompute 2πr when the radius changes.
 */
function Ring({ percent }: { percent: number }) {
  const filled = Math.max(0, Math.min(percent, 100));

  return (
    <svg className="today-ring" viewBox="0 0 100 100" aria-hidden="true">
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

/**
 * Today's progress against the daily goal.
 *
 * ## What the design asked for and the server cannot answer
 *
 * The mock lists four rows — Study Time (45 / 60 min), Reviews (32 / 40),
 * Lessons (2 / 3) and Practice (1 / 2) — each with a target. Only one of those
 * targets exists: `daily.goalXp`. There is no study-time tracking anywhere in
 * the product (nothing records session duration), and no per-activity daily
 * targets. So:
 *
 *   - **Study time is gone**, rather than filled with a plausible number.
 *   - **Reviews and lessons are counts, not fractions.** `daily.reviewsDone`
 *     and `daily.lessonsDone` are real; the `/ 40` and `/ 3` beside them in the
 *     mock are not, and a denominator nobody set is a target the learner is
 *     being silently judged against.
 *
 * The ring is `daily.percentOfGoal`, which the server computes — not
 * `xpToday / goalXp` recomputed here. Same rule as the level: one formula, and
 * it lives on the server.
 */
export function TodayCard({ progress }: { progress: Progress }) {
  const { daily } = progress;

  const rows = [
    {
      id: 'xp',
      icon: 'zap' as const,
      label: 'XP earned',
      value: `${daily.xpToday} / ${daily.goalXp}`,
      done: daily.goalMet,
    },
    {
      id: 'reviews',
      icon: 'refresh-cw' as const,
      label: 'Reviews',
      value: String(daily.reviewsDone),
      done: daily.reviewsDone > 0,
    },
    {
      id: 'lessons',
      icon: 'book-open' as const,
      label: 'Lessons',
      value: String(daily.lessonsDone),
      done: daily.lessonsDone > 0,
    },
    {
      id: 'due',
      icon: 'layers' as const,
      label: 'Cards waiting',
      value: String(progress.cardsDueNow),
      // "Done" here means cleared, so the tick is on *zero* — the one row where
      // a bigger number is worse.
      done: progress.cardsDueNow === 0,
    },
  ];

  return (
    <section className="card today-card glass" aria-labelledby="today-heading">
      <h2 className="card-title" id="today-heading">
        Today&rsquo;s progress
      </h2>

      <div className="today-body">
        <div className="today-dial">
          <Ring percent={daily.percentOfGoal} />
          <p className="today-dial-figure tabular">
            {Math.round(daily.percentOfGoal)}%<span>Daily goal</span>
          </p>
        </div>

        <ul className="today-rows">
          {rows.map((row) => (
            <li className={`today-row${row.done ? ' today-row-done' : ''}`} key={row.id}>
              <span className="today-row-icon" aria-hidden="true">
                <Icon name={row.done ? 'check' : row.icon} size={14} />
              </span>
              <span className="today-row-label">{row.label}</span>
              <span className="today-row-value tabular">{row.value}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="today-foot">
        <span>Daily XP</span>
        <strong className="tabular">+{daily.xpToday} XP</strong>
      </p>
    </section>
  );
}
