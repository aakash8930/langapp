import { Link } from '@tanstack/react-router';

import type { Session } from '../useSession';

/**
 * Signed-in state, the site's navigation, and the three numbers worth carrying
 * everywhere: progress toward today's goal, the streak, and the level.
 *
 * Sticky, and the one element that sits over scrolling content — which is
 * exactly what backdrop blur is for, and the only place on the site where the
 * glass has moving content behind it rather than flat paper.
 *
 * The numbers are drawn rather than spelled out because this bar is on every
 * screen: a ring reads as "nearly there" at a glance where `31 / 50` has to be
 * divided first. Each one still carries its exact value in text for anything
 * that cannot see the drawing.
 */
export function Header({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const isAdmin = session.state === 'signedIn' && session.user?.isAdmin;

  return (
    <div className="header">
      <div className="wrap header-inner glass">
        {/* `<Link to>` rather than `<a href="#/…">` throughout: the route target
            is then type-checked against the generated route tree, which is what
            catches a path the tree does not contain at build time instead of on
            a learner's screen. */}
        <Link className="header-mark ja" to="/">
          日本語
        </Link>

        <nav className="header-nav">
          <Link className="nav-link" to="/read">
            Read
          </Link>
          <Link className="nav-link" to="/leagues">
            Leagues
          </Link>
          <Link className="nav-link" to="/social">
            Social
          </Link>
          <Link className="nav-link" to="/practice">
            AI Chat
          </Link>
          {/* The dashboard is unreachable for everyone else — `/creator` bounces a
              non-admin — so hiding the link hides nothing that was available. */}
          {isAdmin && (
            <Link className="nav-link nav-admin" to="/creator">
              <span aria-hidden="true">⚙</span> Creator
            </Link>
          )}
        </nav>

        {session.state === 'signedIn' ? (
          <>
            {session.progress ? (
              <div className="header-stats">
                <DailyGoalRing
                  current={session.progress.daily.xpToday}
                  goal={session.progress.daily.goalXp}
                  met={session.progress.daily.goalMet}
                />
                <StreakFlame days={session.progress.streakDays} />
              </div>
            ) : null}
            <LevelBadge
              level={session.progress?.level ?? null}
              xp={session.user.gamification.xp}
              name={session.user.profile.displayName}
            />
            <button className="link-button" type="button" onClick={onSignOut}>
              Sign out
            </button>
          </>
        ) : session.state === 'signedOut' ? (
          <Link className="btn btn-primary btn-sm" to="/signin">
            Sign in
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/** Radius of the goal ring, in the SVG's own units. Sets the dash length. */
const RING_RADIUS = 14;

/**
 * Today's XP as a ring that fills. Capped at full — overshooting the goal
 * should read as "done", not wrap around to nearly-empty.
 */
function DailyGoalRing({ current, goal, met }: { current: number; goal: number; met: boolean }) {
  // `goal` is 10–1000 server-side, but guard the divide anyway: a zero here
  // would put NaN into the dash offset and erase the ring entirely.
  const fraction = Math.min(current / Math.max(goal, 1), 1);
  const circumference = 2 * Math.PI * RING_RADIUS;

  return (
    <span
      className={`daily-ring${met ? ' daily-ring-done' : ''}`}
      title={`${current} of ${goal} XP today`}
      role="img"
      aria-label={
        met
          ? `Daily goal met: ${current} of ${goal} XP`
          : `${current} of ${goal} XP toward today's goal`
      }
    >
      <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true" focusable="false">
        <circle cx="18" cy="18" r={RING_RADIUS} fill="none" stroke="var(--hairline)" strokeWidth="3" />
        <circle
          className="daily-ring-fill"
          cx="18"
          cy="18"
          r={RING_RADIUS}
          fill="none"
          stroke={met ? 'var(--brand-success)' : 'var(--brand-primary)'}
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          strokeLinecap="round"
          transform="rotate(-90 18 18)"
        />
      </svg>
      <span className="daily-ring-text tabular" aria-hidden="true">
        {current}
      </span>
    </span>
  );
}

/**
 * The streak, as a flame that grows for the first month and then stops.
 *
 * The size goes on a custom property rather than on `transform`, because the
 * idle flicker animates `transform` too and an animation beats an inline style
 * — set directly, the flame would silently never grow.
 */
function StreakFlame({ days }: { days: number }) {
  const scale = days > 0 ? 1 + Math.min(days / 30, 1) * 0.4 : 1;
  const hot = days >= 7;

  return (
    <span
      className={`streak-flame${days > 0 ? ' streak-active' : ''}${hot ? ' streak-hot' : ''}`}
      title={days > 0 ? `${days}-day streak` : 'No streak yet — study today to start one'}
      role="img"
      aria-label={days > 0 ? `${days} day streak` : 'No streak yet'}
    >
      <span
        className="streak-fire"
        style={{ '--flame-scale': scale } as React.CSSProperties}
        aria-hidden="true"
      >
        {days > 0 ? '🔥' : '❄️'}
      </span>
      <span className="streak-count tabular" aria-hidden="true">
        {days}
      </span>
    </span>
  );
}

/**
 * Level and name.
 *
 * `level` comes from `/me/progress`, never recomputed here. The server's curve
 * is a flat 100 XP per level (`api/src/user/gamification/level.ts`) and it is
 * free to change; a second formula on this side would disagree with every other
 * surface the moment it did. Null while progress is still loading — the name
 * renders on its own rather than flashing a wrong number.
 */
function LevelBadge({ level, xp, name }: { level: number | null; xp: number; name: string }) {
  const tier = level === null ? 'bronze' : levelTier(level);

  return (
    <span
      className={`level-badge level-${tier}`}
      title={level === null ? `${xp} XP` : `Level ${level} · ${xp} XP`}
    >
      {level === null ? null : (
        <span className="level-number">
          <span className="visually-hidden">Level </span>Lv{level}
        </span>
      )}
      <span className="header-name">{name}</span>
    </span>
  );
}

/**
 * Metal bands over the server's level. Chosen against its 100-XP-per-level
 * curve so bronze covers roughly the first week and master is a long haul:
 * silver at 500 XP, gold at 1000, diamond at 2000, master at 3500.
 */
function levelTier(level: number): string {
  if (level >= 36) return 'master';
  if (level >= 21) return 'diamond';
  if (level >= 11) return 'gold';
  if (level >= 6) return 'silver';
  return 'bronze';
}
