import type { Session } from '../useSession';

/**
 * Signed-in state and the two numbers worth carrying everywhere: XP toward
 * today's goal, and the streak.
 *
 * Sticky, and the one element that sits over scrolling content — which is
 * exactly what backdrop blur is for, and the only place on the site where the
 * glass has moving content behind it rather than flat paper.
 */
export function Header({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  return (
    <div className="header">
      <div className="wrap header-inner glass">
        <a className="header-mark ja" href="#/">
          日本語
        </a>

        {session.state === 'signedIn' ? (
          <>
            {session.progress ? (
              <div className="header-stats">
                <Metric
                  label="Today"
                  value={`${session.progress.daily.xpToday} / ${session.progress.daily.goalXp}`}
                  done={session.progress.daily.goalMet}
                />
                <Metric
                  label="Streak"
                  value={`${session.progress.streakDays}`}
                  done={session.progress.streakDays > 0}
                />
              </div>
            ) : null}
            <span className="header-name">{session.user.profile.displayName}</span>
            <button className="link-button" type="button" onClick={onSignOut}>
              Sign out
            </button>
          </>
        ) : session.state === 'signedOut' ? (
          <a className="link-button" href="#start">
            Sign in
          </a>
        ) : null}
      </div>
    </div>
  );
}

function Metric({ label, value, done }: { label: string; value: string; done: boolean }) {
  return (
    <span className="metric">
      <span className="metric-label">{label}</span>
      <span className={`metric-value tabular${done ? ' metric-done' : ''}`}>{value}</span>
    </span>
  );
}
