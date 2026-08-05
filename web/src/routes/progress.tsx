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

/**
 * The progress screen.
 *
 * ## Two endpoints nothing was reading
 *
 * `GET /learning/memory-model` and `GET /learning/analytics` have existed on
 * the API the whole time and no surface consumed either. Between them they
 * answer the questions the dashboard's small tiles cannot: how many cards
 * exist, how they are distributed across mastery bands, what the retention rate
 * is, and how the forgetting curve actually looks for this learner.
 *
 * ## The two rates are on different scales, and that is the trap
 *
 * `memoryModel.overallRetentionRate` is a **percentage** (0–100). The server
 * has already scaled it. `analytics.accuracyRateToday` is a **fraction**
 * (0–1). Multiplying the first by 100 gives 8300%, and rendering the second
 * raw gives "0.83%". They are formatted separately below for that reason and
 * not out of inconsistency — see the types in `api.ts`.
 *
 * ## No FSRS internals
 *
 * Nothing here shows stability or difficulty. The leak rule says those must not
 * reach a client and the API enforces it: neither field is in either response.
 * The mastery bands are the server's own summary of the same information, which
 * is the form a learner can actually use.
 */
export const Route = createFileRoute('/progress')({
  component: ProgressPage,
});

/** The bands, in the order they are earned. */
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
        <p className="page-sub">
          What you have learned, and how well it is staying learned.
        </p>
      </header>

      {/* The headline figures come from three different responses, so each
          renders as soon as its own query lands rather than waiting on the
          slowest of them. */}
      <section className="stat-band" aria-label="Headline figures">
        <Stat
          label="Total XP"
          value={progress ? progress.xp.toLocaleString() : null}
          note={progress ? `Level ${progress.level}` : ''}
        />
        <Stat
          label="Cards in rotation"
          value={memory.data ? String(memory.data.totalCards) : null}
          note={memory.isError ? 'Unavailable' : 'Across every item you have met'}
        />
        <Stat
          label="Retention"
          value={
            // Already a percentage. See the note in this file's header.
            memory.data ? `${Math.round(memory.data.overallRetentionRate)}%` : null
          }
          note={memory.isError ? 'Unavailable' : 'Answered right on first try'}
        />
        <Stat
          label="Mastered"
          value={analytics.data ? String(analytics.data.masteredCount) : null}
          note={analytics.isError ? 'Unavailable' : 'Items at long intervals'}
        />
      </section>

      <div className="progress-grid">
        <section className="card glass" aria-labelledby="bands-heading">
          <h2 className="card-title" id="bands-heading">
            Mastery
          </h2>

          {memory.isPending ? (
            <p className="card-note">Loading your memory model…</p>
          ) : memory.isError ? (
            <p className="card-note">
              The memory model could not be loaded. The API may be asleep — nothing here is lost.
            </p>
          ) : memory.data.totalCards === 0 ? (
            <p className="card-note">
              No cards yet. Finishing a lesson is what seeds them, and reviews start the day after.
            </p>
          ) : (
            <MasteryBars memory={memory.data} />
          )}
        </section>

        <section className="card glass" aria-labelledby="today-heading">
          <h2 className="card-title" id="today-heading">
            Today
          </h2>

          {analytics.isPending ? (
            <p className="card-note">Loading today&rsquo;s numbers…</p>
          ) : analytics.isError ? (
            <p className="card-note">Today&rsquo;s review numbers could not be loaded.</p>
          ) : analytics.data.totalReviewsToday === 0 ? (
            <p className="card-note">
              No reviews yet today. Accuracy and pace appear once there is something to measure.
            </p>
          ) : (
            <dl className="fact-list">
              <Fact label="Reviews" value={String(analytics.data.totalReviewsToday)} />
              <Fact
                label="Accuracy"
                // A fraction, unlike retention above.
                value={`${Math.round(analytics.data.accuracyRateToday * 100)}%`}
              />
              <Fact
                label="Average answer"
                value={formatMs(analytics.data.averageResponseTimeMs)}
              />
            </dl>
          )}
        </section>

        <section className="card glass curve-card" aria-labelledby="curve-heading">
          <h2 className="card-title" id="curve-heading">
            Forgetting curve
          </h2>
          <p className="card-note">
            How much you still recall as the gap since the last review grows. Spaced repetition
            works by scheduling the next review just before this falls off.
          </p>

          {memory.isPending ? (
            <p className="card-note">Loading…</p>
          ) : memory.isError || memory.data.forgettingCurve.length === 0 ? (
            <p className="card-note">
              Not enough review history yet to plot a curve. It needs cards that have come back at
              a range of intervals.
            </p>
          ) : (
            <Curve points={memory.data.forgettingCurve} />
          )}
        </section>
      </div>
    </div>
  );
}

/** A headline figure. `null` is the loading state; the label stays either way. */
function Stat({ label, value, note }: { label: string; value: string | null; note: string }) {
  return (
    <div className="stat-tile glass">
      <p className="stat-tile-label">{label}</p>
      <p className="stat-tile-value tabular">{value ?? '—'}</p>
      <p className="stat-tile-note">{note}</p>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  );
}

/**
 * The mastery bands as proportional bars.
 *
 * Percentages are of `totalCards` rather than of the summed bands, because a
 * band the server did not return should shrink the bars rather than being
 * silently redistributed across the ones it did.
 */
function MasteryBars({ memory }: { memory: MemoryModel }) {
  return (
    <ul className="band-list">
      {BANDS.map((band) => {
        const count = memory.masteryBreakdown[band.id] ?? 0;
        const percent = memory.totalCards > 0 ? (count / memory.totalCards) * 100 : 0;

        return (
          <li className="band" key={band.id}>
            <p className="band-head">
              <span className="band-label">{band.label}</span>
              <span className="band-count tabular">
                {count}
                <span className="band-percent"> · {Math.round(percent)}%</span>
              </span>
            </p>
            <span className={`band-bar band-bar-${band.id}`} aria-hidden="true">
              <span className="band-bar-fill" style={{ width: `${percent}%` }} />
            </span>
            <p className="band-note">{band.note}</p>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The forgetting curve, drawn as an inline SVG polyline.
 *
 * Hand-rolled rather than pulling in a chart library — it is one polyline over
 * a fixed viewBox, and the project's rule is to write the small adapter rather
 * than take the dependency. The viewBox is 0–100 in both axes so the points map
 * straight from percentages with no scale maths to get wrong.
 *
 * `preserveAspectRatio="none"` lets it stretch to whatever width the card is,
 * which is fine for a trend line and would not be for anything with a circle in
 * it.
 */
function Curve({ points }: { points: { day: number; retentionRate: number }[] }) {
  const maxDay = Math.max(...points.map((point) => point.day), 1);

  const plotted = points.map((point) => ({
    x: (point.day / maxDay) * 100,
    // SVG y grows downward; retention should grow upward.
    y: 100 - Math.max(0, Math.min(point.retentionRate, 100)),
    ...point,
  }));

  const line = plotted.map((point) => `${point.x},${point.y}`).join(' ');

  return (
    <figure className="curve">
      <svg
        className="curve-svg"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Retention falls from ${Math.round(points[0]?.retentionRate ?? 0)}% to ${Math.round(points[points.length - 1]?.retentionRate ?? 0)}% over ${maxDay} days`}
      >
        {[25, 50, 75].map((y) => (
          <line className="curve-gridline" key={y} x1="0" y1={y} x2="100" y2={y} />
        ))}
        <polyline className="curve-line" points={line} />
      </svg>

      {/* The figures in text as well as in the drawing — the same rule the
          header's rings follow. */}
      <figcaption className="curve-caption">
        <span>Day 0</span>
        <span>Day {maxDay}</span>
      </figcaption>
    </figure>
  );
}

/** Milliseconds as something a person reads. */
function formatMs(ms: number): string {
  if (ms <= 0) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
