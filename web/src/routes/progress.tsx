import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';

import {
  fetchAnalytics,
  fetchMemoryModel,
  fetchReviewHeatmap,
  fetchReviewForecast,
  type MasteryLevel,
  type MemoryModel,
  type HeatmapEntry,
  type ForecastEntry,
} from '../api';
import { queryKeys } from '../queryKeys';
import { useSession } from '../useSession';

import './progress.css';

export const Route = createFileRoute('/progress')({
  component: ProgressPage,
});

const BANDS: { id: MasteryLevel; label: string; note: string }[] = [
  { id: 'new', label: 'New', note: 'Seen, not yet answered' },
  { id: 'learning', label: 'Learning', note: 'Still in the short intervals' },
  { id: 'familiar', label: 'Familiar', note: 'Coming back days apart' },
  { id: 'mastered', label: 'Mastered', note: 'Long intervals, high retention' },
];

function ProgressPage() {
  const { session } = useSession();
  const signedIn = session.state === 'signedIn';

  const memory = useQuery({
    queryKey: queryKeys.learning.memoryModel,
    queryFn: fetchMemoryModel,
    enabled: signedIn,
  });

  const analytics = useQuery({
    queryKey: queryKeys.learning.analytics,
    queryFn: fetchAnalytics,
    enabled: signedIn,
  });

  const heatmap = useQuery({
    queryKey: ['reviews', 'heatmap'],
    queryFn: () => fetchReviewHeatmap(84),
    enabled: signedIn,
  });

  const forecast = useQuery({
    queryKey: ['reviews', 'forecast'],
    queryFn: fetchReviewForecast,
    enabled: signedIn,
  });

  if (!signedIn) {
    return (
      <div className="page">
        <header className="page-head">
          <h1 className="page-title">Progress</h1>
          <p className="page-sub">Sign in to see how your memory is holding up.</p>
        </header>
      </div>
    );
  }

  const progress = session.progress;

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">Progress</h1>
        <p className="page-sub">What you have learned, and how well it is staying learned.</p>
      </header>

      <section className="stat-band" aria-label="Headline figures">
        <Stat label="Total XP" value={progress ? progress.xp.toLocaleString() : null} note={progress ? `Level ${progress.level}` : ''} />
        <Stat label="Streak" value={progress ? `${progress.streakDays}` : null} note="days studied in a row" />
        <Stat label="Retention" value={memory.data ? `${Math.round(memory.data.overallRetentionRate)}%` : null} note={memory.isError ? 'Unavailable' : 'Answered right on first try'} />
        <Stat label="Mastered" value={analytics.data ? String(analytics.data.masteredCount) : null} note={analytics.isError ? 'Unavailable' : 'Items at long intervals'} />
      </section>

      {progress && (
        <div className="progress-grid" style={{ marginBottom: 'var(--s-xl)' }}>
          <section className="card glass" aria-labelledby="daily-heading">
            <h2 className="card-title" id="daily-heading">Daily Goal</h2>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--s-sm)', marginBottom: 'var(--s-md)' }}>
              <span className="stat-tile-value tabular" style={{ fontSize: 'var(--text-heading)' }}>{progress.daily.xpToday}</span>
              <span style={{ color: 'var(--ink-soft)' }}>/ {progress.daily.goalXp} XP</span>
            </div>
            <div className="band-bar" style={{ height: '12px' }}>
              <span className="band-bar-fill" style={{ width: `${Math.min(100, progress.daily.percentOfGoal)}%`, background: 'var(--brand-primary)' }} />
            </div>
            <p className="band-note" style={{ marginTop: 'var(--s-sm)' }}>
              {progress.daily.percentOfGoal >= 100 ? '✓ Goal met!' : `${Math.round(progress.daily.percentOfGoal)}% of daily goal`}
            </p>
          </section>

          <section className="card glass" aria-labelledby="weekly-heading">
            <h2 className="card-title" id="weekly-heading">Weekly Goal</h2>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--s-sm)', marginBottom: 'var(--s-md)' }}>
              <span className="stat-tile-value tabular" style={{ fontSize: 'var(--text-heading)' }}>{progress.daily.xpToday * 7}</span>
              <span style={{ color: 'var(--ink-soft)' }}>/ {progress.daily.goalXp * 7} XP</span>
            </div>
            <div className="band-bar" style={{ height: '12px' }}>
              <span className="band-bar-fill" style={{ width: `${Math.min(100, (progress.daily.xpToday * 7) / (progress.daily.goalXp * 7) * 100)}%`, background: 'var(--brand-tertiary)' }} />
            </div>
            <p className="band-note" style={{ marginTop: 'var(--s-sm)' }}>
              {progress.daily.lessonsDone} lessons · {progress.daily.reviewsDone} reviews today
            </p>
          </section>

          <section className="card glass" aria-labelledby="monthly-heading">
            <h2 className="card-title" id="monthly-heading">Monthly Goal</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-md)' }}>
              <div>
                <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-small)' }}>Lessons completed</span>
                <p style={{ fontSize: 'var(--text-heading)', fontWeight: 700, margin: 'var(--s-xs) 0' }} className="tabular">{progress.lessonsCompleted}</p>
              </div>
              <div>
                <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-small)' }}>Cards mastered</span>
                <p style={{ fontSize: 'var(--text-heading)', fontWeight: 700, margin: 'var(--s-xs) 0' }} className="tabular">{analytics.data?.masteredCount ?? '—'}</p>
              </div>
              <div>
                <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-small)' }}>Last study day</span>
                <p style={{ fontSize: 'var(--text-heading)', fontWeight: 700, margin: 'var(--s-xs) 0', color: 'var(--brand-success)' }}>
                  {progress.lastStudyDate ? new Date(progress.lastStudyDate).toLocaleDateString() : '—'}
                </p>
              </div>
            </div>
          </section>
        </div>
      )}

      <div className="progress-grid">
        <section className="card glass" aria-labelledby="bands-heading">
          <h2 className="card-title" id="bands-heading">Mastery</h2>
          {memory.isPending ? <p className="card-note">Loading…</p> :
           memory.isError ? <p className="card-note">Could not load.</p> :
           memory.data.totalCards === 0 ? <p className="card-note">No cards yet. Finish a lesson to start.</p> :
           <MasteryBars memory={memory.data} />}
        </section>

        <section className="card glass" aria-labelledby="today-heading">
          <h2 className="card-title" id="today-heading">Today</h2>
          {analytics.isPending ? <p className="card-note">Loading…</p> :
           analytics.isError ? <p className="card-note">Could not load.</p> :
           analytics.data.totalReviewsToday === 0 ? <p className="card-note">No reviews yet today.</p> :
           <dl className="fact-list">
             <Fact label="Reviews" value={String(analytics.data.totalReviewsToday)} />
             <Fact label="Accuracy" value={`${Math.round(analytics.data.accuracyRateToday * 100)}%`} />
             <Fact label="Average answer" value={formatMs(analytics.data.averageResponseTimeMs)} />
           </dl>}
        </section>

        {/* Study Heatmap */}
        <section className="card glass" aria-labelledby="heatmap-heading">
          <h2 className="card-title" id="heatmap-heading">Study Heatmap</h2>
          <p className="card-note">Each cell is a day. Darker = more reviews that day.</p>
          {heatmap.isPending ? <p className="card-note">Loading…</p> :
           heatmap.isError ? <p className="card-note">Could not load.</p> :
           <ActivityHeatmap data={heatmap.data ?? []} />}
        </section>

        {/* Forgetting Curve */}
        <section className="card glass curve-card" aria-labelledby="curve-heading">
          <h2 className="card-title" id="curve-heading">Forgetting curve</h2>
          <p className="card-note">How retention falls as the gap since last review grows.</p>
          {memory.isPending ? <p className="card-note">Loading…</p> :
           memory.isError || memory.data.forgettingCurve.length === 0 ? <p className="card-note">Not enough history yet.</p> :
           <Curve points={memory.data.forgettingCurve} />}
        </section>

        {/* Forecast */}
        <section className="card glass curve-card" aria-labelledby="forecast-heading">
          <h2 className="card-title" id="forecast-heading">Forecast</h2>
          <p className="card-note">Upcoming reviews based on your due cards.</p>
          {forecast.isPending ? <p className="card-note">Loading…</p> :
           forecast.isError ? <p className="card-note">Could not load.</p> :
           <ForecastView data={forecast.data ?? []} />}
        </section>
      </div>
    </div>
  );
}

function ActivityHeatmap({ data }: { data: HeatmapEntry[] }) {
  const max = Math.max(...data.map((d) => d.count), 10);

  return (
    <div className="heatmap" role="img" aria-label="Study activity over time">
      <div className="heatmap-grid">
        {data.map((c) => {
          const intensity = Math.min(c.count / max, 1);
          const r = Math.round(235 - intensity * 210);
          const g = Math.round(235 - intensity * 180);
          const b = Math.round(245 - intensity * 100);
          return (
            <div
              key={c.date}
              className="heatmap-cell"
              title={`${c.date}: ${c.count} reviews`}
              style={{ background: intensity > 0 ? `rgb(${r},${g},${b})` : 'var(--hairline)' }}
            />
          );
        })}
      </div>
      <div className="heatmap-labels">
        <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-caption)' }}>Less</span>
        <div className="heatmap-legend">
          {[0, 0.25, 0.5, 0.75, 1].map((intensity) => {
            const r = Math.round(235 - intensity * 210);
            const g = Math.round(235 - intensity * 180);
            const b = Math.round(245 - intensity * 100);
            return <div key={intensity} style={{ width: '12px', height: '12px', borderRadius: '2px', background: `rgb(${r},${g},${b})` }} />;
          })}
        </div>
        <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-caption)' }}>More</span>
      </div>
    </div>
  );
}

function ForecastView({ data }: { data: ForecastEntry[] }) {
  if (data.length === 0) return <p className="card-note">No cards yet — finish some lessons first.</p>;
  const maxDue = Math.max(...data.map((f) => f.due), 1);
  const totalDue = data[data.length - 1]?.due ?? 0;

  return (
    <div>
      <dl className="fact-list">
        <Fact label="Total due now" value={String(data[0]?.due ?? 0)} />
        <Fact label="Due in 4 weeks" value={String(totalDue)} />
        <Fact label="Daily pace" value={`~${Math.max(1, Math.round(totalDue / 28))} reviews/day`} />
      </dl>

      <div className="forecast-bars" style={{ marginTop: 'var(--s-lg)' }}>
        {data.map((f) => {
          const barH = Math.min(120, Math.max(8, (f.due / maxDue) * 100));
          return (
            <div key={f.weekLabel} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--s-xs)', flex: 1 }}>
              <span className="tabular" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-soft)' }}>{f.due}</span>
              <div style={{ width: '100%', maxWidth: '40px', height: `${barH}px`, background: 'var(--brand-primary)', borderRadius: 'var(--radius-sm) 0 0 0', opacity: 0.7 + data.indexOf(f) * 0.08 }} />
              <span style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-soft)' }}>{f.weekLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string | null; note: string }) {
  return <div className="stat-tile glass"><p className="stat-tile-label">{label}</p><p className="stat-tile-value tabular">{value ?? '—'}</p><p className="stat-tile-note">{note}</p></div>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="fact"><dt>{label}</dt><dd className="tabular">{value}</dd></div>;
}

function MasteryBars({ memory }: { memory: MemoryModel }) {
  return (
    <ul className="band-list">
      {BANDS.map((band) => {
        const count = memory.masteryBreakdown[band.id] ?? 0;
        const percent = memory.totalCards > 0 ? (count / memory.totalCards) * 100 : 0;
        return (
          <li className="band" key={band.id}>
            <p className="band-head"><span className="band-label">{band.label}</span><span className="band-count tabular">{count}<span className="band-percent"> · {Math.round(percent)}%</span></span></p>
            <span className={`band-bar band-bar-${band.id}`} aria-hidden="true"><span className="band-bar-fill" style={{ width: `${percent}%` }} /></span>
            <p className="band-note">{band.note}</p>
          </li>
        );
      })}
    </ul>
  );
}

function Curve({ points }: { points: { day: number; retentionRate: number }[] }) {
  const maxDay = Math.max(...points.map((p) => p.day), 1);
  const plotted = points.map((p) => ({ x: (p.day / maxDay) * 100, y: 100 - Math.max(0, Math.min(p.retentionRate, 100)), ...p }));
  const line = plotted.map((p) => `${p.x},${p.y}`).join(' ');
  return (
    <figure className="curve">
      <svg className="curve-svg" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`Retention from ${Math.round(points[0]?.retentionRate ?? 0)}% to ${Math.round(points[points.length - 1]?.retentionRate ?? 0)}% over ${maxDay} days`}>
        {[25, 50, 75].map((y) => <line className="curve-gridline" key={y} x1="0" y1={y} x2="100" y2={y} />)}
        <polyline className="curve-line" points={line} />
      </svg>
      <figcaption className="curve-caption"><span>Day 0</span><span>Day {maxDay}</span></figcaption>
    </figure>
  );
}

function formatMs(ms: number): string {
  if (ms <= 0) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
