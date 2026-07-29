import type { Progress } from '../api';
import { achievementsFor } from '../gamification';

/**
 * The badge row on the home page.
 *
 * ## Locked badges are shown, and described
 *
 * The sketch this came from greyed locked badges out behind a `?` "to create
 * curiosity". That is the wrong trade here: none of these are surprises worth
 * protecting, and a row of question marks answers neither "what have I done"
 * nor "what is close" — the second being the only reason to look at it. So a
 * locked badge says what it wants and how far off it is, and carries a sliver
 * of fill showing that distance.
 *
 * ## Every tick is true
 *
 * `achievementsFor` derives all of these from `/me/progress` and nothing else,
 * and the set is limited to what that endpoint can actually answer — see the
 * note there about the three that were dropped rather than faked. A badge that
 * lit up on a guess would cost more trust than the whole row is worth.
 *
 * Scrolls horizontally on a narrow screen rather than wrapping to three rows of
 * badges, which would push the curriculum below the fold on a phone.
 */
export function Achievements({ progress }: { progress: Progress }) {
  const badges = achievementsFor(progress);
  const earned = badges.filter((badge) => badge.unlocked).length;

  return (
    <section className="achievements glass panel" aria-labelledby="achievements-heading">
      <div className="achievements-head">
        <h2 id="achievements-heading">Achievements</h2>
        <span className="achievements-score tabular">
          {earned} / {badges.length}
        </span>
      </div>

      <ul className="achievement-row">
        {badges.map((badge) => (
          <li
            key={badge.id}
            className={`achievement${badge.unlocked ? ' achievement-earned' : ''}`}
          >
            <span className="achievement-icon" aria-hidden="true">
              {badge.icon}
            </span>
            <span className="achievement-title">{badge.title}</span>
            <span className="achievement-note">{badge.unlocked ? badge.earned : badge.goal}</span>

            {/* Only on locked badges: a full bar under an earned one would read
                as another thing still in progress. */}
            {badge.unlocked || badge.progress === null ? null : (
              <span className="achievement-bar" aria-hidden="true">
                <span
                  className="achievement-bar-fill"
                  style={{ width: `${Math.round(badge.progress * 100)}%` }}
                />
              </span>
            )}

            <span className="visually-hidden">
              {badge.unlocked ? 'Earned.' : 'Not yet earned.'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
