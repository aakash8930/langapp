import type { Progress, Unit } from '../../api';

import { BadgesCard } from './BadgesCard';
import { CalendarCard } from './CalendarCard';
import { ContinueCard } from './ContinueCard';
import { LevelCard } from './LevelCard';
import { PathCard } from './PathCard';
import { ProverbCard } from './ProverbCard';
import { QuickActionsCard } from './QuickActionsCard';
import { RecommendedCard } from './RecommendedCard';
import { ReviewsCard } from './ReviewsCard';
import { StreakCard } from './StreakCard';
import { TodayCard } from './TodayCard';

import './dashboard.css';

/**
 * The dashboard, assembled.
 *
 * Two regions rather than one grid: a main column whose cards pair up on a
 * twelve-column sub-grid, and a side column that is a plain stack. The side
 * column's cards have no relationship to each other beyond order, and
 * expressing "a stack" as a grid is how a layout acquires rules nobody can
 * later explain.
 *
 * ## Reading order is the layout's order
 *
 * The side column comes second in the markup as well as on screen, so a
 * keyboard or screen reader walks streak → today → continue → reviews before
 * reaching level, badges and the calendar. That ordering is deliberate: the
 * top-left cards are the ones with something to *do*, and the side column is
 * status. On a narrow screen the two regions stack in that same order rather
 * than interleaving, which is what a single grid would have done.
 *
 * ## Everything here needs `progress`
 *
 * Which is why it is a required prop rather than `Progress | null` with eleven
 * internal guards. The route holds the loading state; this component is only
 * mounted once there is something to draw.
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
    <div className="dashboard">
      <div className="dashboard-main">
        <StreakCard progress={progress} tz={tz} />
        <TodayCard progress={progress} />
        <ContinueCard units={units} progress={progress} />
        <ReviewsCard />
        <RecommendedCard units={units} progress={progress} />
        <PathCard units={units} progress={progress} />
      </div>

      <div className="dashboard-side">
        <LevelCard progress={progress} />
        <BadgesCard progress={progress} />
        <CalendarCard progress={progress} tz={tz} />
        <ProverbCard />
        <QuickActionsCard />
      </div>
    </div>
  );
}
