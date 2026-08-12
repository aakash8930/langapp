import type { Progress, Unit } from '../../api';

import { AIRecommendations } from './AIRecommendations';
import { BadgesCard } from './BadgesCard';
import { CommunityFeed } from './CommunityFeed';
import { ContinueLearning } from './ContinueLearning';
import { DashboardFooter } from './DashboardFooter';
import { JLPTPanel } from './JLPTPanel';
import { PracticeBySkill } from './PracticeBySkill';
import { QuickActionsRow } from './QuickActionsRow';
import { RecentLessons } from './RecentLessons';
import { StreakCard } from './StreakCard';
import { TodaysGoalWidget } from './TodaysGoalWidget';
import { UpgradePremium } from './UpgradePremium';

import './dashboard.css';

/** Dashboard composition matching the black-and-gold UI reference. */
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
        <QuickActionsRow />
        <ContinueLearning units={units} progress={progress} />

        <div className="dashboard-middle-grid">
          <PracticeBySkill />
          <AIRecommendations units={units} progress={progress} />
        </div>

        <div className="dashboard-lower-grid">
          <RecentLessons units={units} progress={progress} />
          <BadgesCard progress={progress} />
          <CommunityFeed />
        </div>

        <DashboardFooter />
      </section>

      <aside className="dashboard-side" aria-label="Progress and account status">
        <StreakCard progress={progress} tz={tz} />
        <TodaysGoalWidget progress={progress} />
        <JLPTPanel units={units} progress={progress} />
        <UpgradePremium />
      </aside>
    </div>
  );
}
