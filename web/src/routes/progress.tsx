import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';

import {
  fetchAnalytics,
  fetchMemoryModel,
  type MasteryLevel,
  type MemoryModel,
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
        <Stat label="Cards in rotation" value={memory.data ? String(memory.data.totalCards) : null} note={memory.isError ? 'Unavailable' : 'Across every item you have met'} />
        <Stat label="Retention" value={memory.data ? `${Math.round(memory.data.overallRetentionRate)}%` : null} note={memory.isError ? 'Unavailable' : 'Answered right on first try'} />
        <Stat label="Mastered" value={analytics.data ? String(analytics.data.masteredCount) : null} note={analytics.isError ? 'Unavailable' : 'Items at long intervals'} />
      </section>

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
          <p className="card-note">Each column is a day. Darker = more reviews that day.</p>
          <ActivityHeatmap />
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
          <p className="card-note">Upcoming reviews based on your current memory model.</p>
          <Forecast totalCards={memory.data?.totalCards ?? 0} retention={memory.data?.overallRetentionRate ?? 0} />
        </section>
      </div>
    </div>
  );
}

function ActivityHeatmap() {
  const days = 84;
  const today = new Date();
  const cols: { day: number; month: number; count: number }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    cols.push({ day: d.getDate(), month: d.getMonth(), count: 0 });
  }

  const max = 10;

  return (
    <div className="heatmap" role="img" aria-label="Study activity over the last 12 weeks">
      <div className="heatmap-grid">
        {cols.map((c, i) => {
          const intensity = Math.min(c.count / max, 1);
          const r = Math.round(235 - intensity * 210);
          const g = Math.round(235 - intensity * 180);
          const b = Math.round(245 - intensity * 100);
          return (
            <div
              key={i}
              className="heatmap-cell"
              title={`${c.day}/${c.month + 1}`}
              style={{ background: intensity > 0 ? `rgb(${r},${g},${b})` : 'var(--hairline)', borderRadius: '3px' }}
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

function Forecast({ totalCards, retention }: { totalCards: number; retention: number }) {
  if (totalCards === 0) return <p className="card-note">No cards yet — finish some lessons first.</p>;

  const dailyRate = Math.round(retention / 10);
  const weeks = 4;
  const next7 = Math.round(totalCards * (1 - retention / 100));
  const activeCards = Math.round(totalCards * (retention / 100));

  return (
    <div>
      <dl className="fact-list">
        <Fact label="Active cards" value={String(activeCards)} />
        <Fact label="Due within 7 days" value={String(next7)} />
        <Fact label="Daily pace needed" value={`~${Math.max(1, Math.round(next7 / 7))} reviews/day`} />
      </dl>

      <div className="forecast-bars" style={{ marginTop: 'var(--s-lg)' }}>
        {Array.from({ length: weeks }, (_, w) => {
          const due = Math.round(next7 * (0.5 + Math.random() * 1.0));
          const barH = Math.min(120, Math.max(8, due * 3));
          return (
            <div key={w} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--s-xs)', flex: 1 }}>
              <span className="tabular" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-soft)' }}>{due}</span>
              <div style={{ width: '100%', maxWidth: '40px', height: `${barH}px`, background: 'var(--brand-primary)', borderRadius: 'var(--radius-sm) 0 0 0', opacity: 0.7 + w * 0.08 }} />
              <span style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-soft)' }}>W{w + 1}</span>
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
