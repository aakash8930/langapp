import type { Progress, Unit } from '../../api';

import { AIRecommendations } from './AIRecommendations';
import { BadgesCard } from './BadgesCard';
import { CalendarCard } from './CalendarCard';
import { ContinueCard } from './ContinueCard';
import { LevelCard } from './LevelCard';
import { NotificationBell } from './NotificationBell';
import { PathCard } from './PathCard';
import { QuickActionsRow } from './QuickActionsRow';
import { RecentLessons } from './RecentLessons';
import { ReviewsCard } from './ReviewsCard';
import { StreakCard } from './StreakCard';
import { TodayCard } from './TodayCard';
import { TodaysGoalWidget } from './TodaysGoalWidget';
import { UpgradePremium } from './UpgradePremium';

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
 * ## New panels are labelled, not faked
 *
 * The cards the API cannot answer (notifications, billing, study time,
 * recent activity, JLPT readiness, listening / speaking) are placeholders
 * carrying a "Coming soon" pill and a one-sentence note naming the missing
 * endpoint. The point is to match the design's layout without inventing
 * data — the same rule `gamification.ts` already follows for badges
 * derived from `/me/progress` alone.
 *
 * ## Everything here needs `progress`
 *
 * Which is why it is a required prop rather than `Progress | null` with
 * internal guards. The route holds the loading state; this component is
 * only mounted once there is something to draw.
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
      <section className="dashboard-main" aria-label="Learning dashboard">
        <div className="dashboard-main-header">
          <p className="dashboard-kicker">Your learning space</p>
          <h1 className="dashboard-title">Keep your Japanese moving.</h1>
          <p className="dashboard-subtitle">A clear next step, your daily progress, and the reviews that matter now.</p>
        </div>

        <AIRecommendations units={units} progress={progress} />

        <div className="dashboard-progress-grid">
          <StreakCard progress={progress} tz={tz} />
          <TodayCard progress={progress} />
        </div>

        <div className="dashboard-action-grid">
          <ContinueCard units={units} progress={progress} />
          <ReviewsCard />
        </div>

        <QuickActionsRow />
        <RecentLessons units={units} progress={progress} />
        <PathCard units={units} progress={progress} />
      </section>

      <aside className="dashboard-side" aria-label="Progress and account status">
        <NotificationBell />
        <LevelCard progress={progress} />
        <UpgradePremium />
        <BadgesCard progress={progress} />
        <TodaysGoalWidget progress={progress} />
        <CalendarCard progress={progress} tz={tz} />
      </aside>
    </div>
  );
}