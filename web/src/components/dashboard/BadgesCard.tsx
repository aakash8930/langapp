import { Link } from '@tanstack/react-router';

import type { Progress } from '../../api';
import { achievementsFor } from '../../gamification';

/**
 * The badge shelf.
 *
 * The full row with its descriptions and progress slivers is `Achievements`;
 * this is the dashboard's condensed form — six badges and a score, sized to the
 * side column.
 *
 * ## "View all" goes to `/achievements`
 *
 * It did not exist when this card was written — `/achievements` was a `planned`
 * sidebar row, so the corner held the score alone rather than a link to a route
 * the tree did not contain. The route exists now and carries the full row with
 * goal text and progress slivers, so the link is real and the score moves in
 * beside it.
 *
 * Every tick here is derived from `/me/progress` alone and nothing is stored;
 * see `gamification.ts` for the three badges that were dropped rather than
 * faked.
 */
export function BadgesCard({ progress }: { progress: Progress }) {
  const badges = achievementsFor(progress);
  const earned = badges.filter((badge) => badge.unlocked).length;

  return (
    <section className="card achievements-card glass" aria-labelledby="badges-heading">
      <div className="card-head">
        <h2 className="card-title" id="badges-heading">
          Achievements
        </h2>
        <span className="badges-corner">
          <span className="card-pill tabular">
            {earned} / {badges.length}
          </span>
          <Link className="card-link" to="/achievements">
            View all
          </Link>
        </span>
      </div>

      <ul className="badge-grid">
        {badges.slice(0, 4).map((badge) => (
          <li
            className={`badge${badge.unlocked ? ' badge-earned' : ''}`}
            key={badge.id}
            // The tooltip is the short form; the visually-hidden text below is
            // what assistive tech gets, because `title` is announced
            // inconsistently and not at all on touch.
            title={badge.unlocked ? badge.earned : badge.goal}
          >
            <span className="badge-icon" aria-hidden="true">
              {badge.icon}
            </span>
            <span className="visually-hidden">
              {badge.title} — {badge.unlocked ? badge.earned : badge.goal}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
