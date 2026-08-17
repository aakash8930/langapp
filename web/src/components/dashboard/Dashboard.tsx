import type { Progress, Unit } from '../../api';

import { ContinueLearning } from './ContinueLearning';
import { PracticeBySkill } from './PracticeBySkill';
import { StreakCard } from './StreakCard';
import { TodaysGoalWidget } from './TodaysGoalWidget';

import './dashboard.css';

/**
 * The learner dashboard, reduced to one essential path.
 *
 * Three blocks and nothing else:
 *
 *   1. **Continue learning** — the single "what should I do next" answer.
 *   2. **Progress** — streak and today's goal, the two quick-glance figures.
 *   3. **Practice by skill** — the four ways to reinforce what is learned.
 *
 * Secondary widgets (community feed, badges, JLPT panel, recommendations, an
 * upgrade/free-access card and a footer strip) were removed after learner
 * testing reported the dashboard as too complex. Each removed destination is
 * still reachable from the sidebar; it just no longer competes with the
 * primary path on the home screen.
 */
export function Dashboard({
  units,
  progress,
  tz,
}: {
  units: Unit[];
  progress: Progress;
  tz: string;
}) {
  return (
    <div className="dashboard dashboard-reference">
      <section className="dashboard-main" aria-label="Learning dashboard">
        <ContinueLearning units={units} progress={progress} />

        <div className="dashboard-progress-grid">
          <StreakCard progress={progress} tz={tz} />
          <TodaysGoalWidget progress={progress} />
        </div>

        <PracticeBySkill />
      </section>
    </div>
  );
}
