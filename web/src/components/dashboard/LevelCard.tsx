import { useQuery } from '@tanstack/react-query';

import { fetchLeaderboard, type Progress } from '../../api';
import { levelTier } from '../../gamification';
import { queryKeys } from '../../queryKeys';
import { Icon } from '../ui/Icon';

/** Display names for the tiers `levelTier` bands the server's level into. */
const TIER_NAMES: Record<ReturnType<typeof levelTier>, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  diamond: 'Diamond',
  master: 'Master',
};

/**
 * Level, XP, and where that puts you.
 *
 * ## The level is the server's, and so is the curve
 *
 * `progress.level`, `xpIntoLevel` and `xpForNextLevel` are rendered as sent.
 * The server's curve is a flat 100 XP per level and is free to change; a second
 * formula here would disagree with every other surface the moment it did.
 * `levelTier` bands *over* that number, which is fine — it reads the server's
 * answer rather than replacing it.
 *
 * ## "Global Rank #3,247" is not a number this API has
 *
 * The design shows a global rank. There is no global ranking endpoint. What
 * exists is `/social/leaderboard`, which is a *weekly league* — a tier, a
 * bracket of players, and `yourRank` inside that bracket. Those are different
 * claims, so the tile says which one it is and names the tier.
 *
 * Three states it has to handle, and all three are real:
 *   - **not opted in** — leagues are opt-in, and `optedIn: false` means there
 *     is no rank rather than a rank of nothing,
 *   - **opted in but unranked** (`yourRank: null`) — no XP this week yet,
 *   - **failed to load** — the tile drops rather than showing a dash, because
 *     the other two figures on this card are still good and a broken third
 *     makes them look doubtful too.
 */
export function LevelCard({ progress }: { progress: Progress }) {
  // Its own query rather than a route loader dependency: the two figures beside
  // it are already on screen from `/me/progress`, and a league that is slow or
  // down must not hold up the card that carries the level.
  const league = useQuery({
    queryKey: queryKeys.social.leaderboard,
    queryFn: fetchLeaderboard,
    // A weekly bracket does not move fast enough to be worth refetching on
    // every return to the dashboard.
    staleTime: 5 * 60_000,
    retry: false,
  });

  const tier = levelTier(progress.level);
  const percent =
    progress.xpForNextLevel > 0
      ? Math.min((progress.xpIntoLevel / progress.xpForNextLevel) * 100, 100)
      : 100;

  const rank =
    league.data === undefined
      ? null
      : !league.data.optedIn
        ? { label: 'League', value: 'Opted out' }
        : league.data.yourRank === null
          ? { label: `${league.data.tierName} league`, value: 'Unranked' }
          : { label: `${league.data.tierName} league`, value: `#${league.data.yourRank}` };

  return (
    <section className="card glass" aria-labelledby="level-heading">
      <h2 className="card-title" id="level-heading">
        XP &amp; level
      </h2>

      <div className="level-head">
        <span className={`level-crest level-crest-${tier}`} aria-hidden="true">
          <Icon name="crown" size={26} />
        </span>
        <p className="level-name">
          <strong>Level {progress.level}</strong>
          <span>{TIER_NAMES[tier]}</span>
        </p>
      </div>

      <span className="level-bar" aria-hidden="true">
        <span className="level-bar-fill" style={{ width: `${percent}%` }} />
      </span>

      <p className="level-bar-note tabular">
        {progress.xpIntoLevel} / {progress.xpForNextLevel} XP to level{' '}
        {progress.level + 1}
      </p>

      <dl className="level-stats">
        <div className="level-stat">
          <dt>XP today</dt>
          <dd className="tabular">{progress.daily.xpToday}</dd>
        </div>
        <div className="level-stat">
          <dt>Total XP</dt>
          <dd className="tabular">{progress.xp.toLocaleString()}</dd>
        </div>
        {rank ? (
          <div className="level-stat">
            <dt>{rank.label}</dt>
            <dd className="tabular">{rank.value}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
