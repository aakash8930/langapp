import { createFileRoute, Link } from '@tanstack/react-router';

import { useSession } from '../useSession';
import { progressRouteStyles } from '../styles/progressRouteStyles';

export const Route = createFileRoute('/progress')({ component: ProgressPage });

function ProgressPage() {
  void progressRouteStyles;
  const { session } = useSession();

  if (session.state !== 'signedIn') {
    return (
      <div className="page">
        <header className="page-head">
          <h1 className="page-title">Progress</h1>
          <p className="page-sub">Sign in to see your course progress.</p>
        </header>
      </div>
    );
  }

  if (!session.progress) {
    return <main className="page" aria-busy="true"><p className="card-note">Loading progress…</p></main>;
  }

  const progress = session.progress;
  const levelPercent = progress.xpForNextLevel
    ? Math.min(100, progress.xpIntoLevel / progress.xpForNextLevel * 100)
    : 0;

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">Progress</h1>
        <p className="page-sub">Your completed lessons, daily activity, XP, and course milestones.</p>
      </header>

      <section className="stat-band" aria-label="Progress summary">
        <Stat label="Total XP" value={progress.xp.toLocaleString()} note={`Level ${progress.level}`} />
        <Stat label="Streak" value={String(progress.streakDays)} note="days studied in a row" />
        <Stat label="Lessons" value={String(progress.lessonsCompleted)} note="completed at least once" />
        <Stat label="Units passed" value={String(progress.passedUnits.length)} note="checkpoint milestones" />
      </section>

      <section className="glass progress-level-card" aria-label="Platform level progress">
        <div>
          <p className="progress-kicker">PLATFORM LEVEL</p>
          <h2>Level {progress.level}</h2>
          <p>{progress.xpIntoLevel.toLocaleString()} of {progress.xpForNextLevel.toLocaleString()} XP toward the next level</p>
        </div>
        <div className="progress-level-meter"><span style={{ width: `${levelPercent}%` }} /></div>
        <small>Platform level reflects GENKŌ activity, not a JLPT proficiency level.</small>
      </section>

      <div className="progress-grid">
        <section className="card glass" aria-labelledby="daily-heading">
          <h2 className="card-title" id="daily-heading">Today</h2>
          <p className="stat-tile-value tabular">{progress.daily.xpToday} / {progress.daily.goalXp} XP</p>
          <div className="band-bar"><span className="band-bar-fill" style={{ width: `${progress.daily.percentOfGoal}%` }} /></div>
          <p className="band-note">{progress.daily.lessonsDone} lesson{progress.daily.lessonsDone === 1 ? '' : 's'} completed today</p>
        </section>

        <section className="card glass" aria-labelledby="start-heading">
          <h2 className="card-title" id="start-heading">Recommended start</h2>
          <p className="stat-tile-value">{progress.startingRecommendation.title}</p>
          <p className="band-note">{progress.startingRecommendation.reason}</p>
          <Link className="btn btn-primary" to="/courses">Open course</Link>
        </section>

        <section className="card glass" aria-labelledby="milestones-heading">
          <h2 className="card-title" id="milestones-heading">Checkpoint milestones</h2>
          {progress.passedUnits.length > 0 ? (
            <ul>{progress.passedUnits.map((unit) => <li key={unit}>{unit}</li>)}</ul>
          ) : <p className="card-note">No unit checkpoints passed yet.</p>}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="stat-tile glass"><p className="stat-tile-label">{label}</p><p className="stat-tile-value tabular">{value}</p><p className="stat-tile-note">{note}</p></div>;
}
