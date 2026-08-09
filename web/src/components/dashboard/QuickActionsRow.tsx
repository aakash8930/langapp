import { Link } from '@tanstack/react-router';

import type { RoutePath } from '../../types/layout';
import { Icon, type IconName } from '../ui/Icon';

/**
 * Six ways straight into the product, surfaced as a horizontal row in the main
 * column rather than a tile grid in the side column.
 *
 * ## Every tile goes somewhere
 *
 * The design's six are Vocabulary Practice, Kanji Practice, Grammar Quiz,
 * Review Now, AI Tutor and Flashcard Session. Three of those are screens that
 * do not exist — there is no per-category practice mode and no flashcard
 * session, and the sidebar already carries them as `planned` rows.
 *
 * A locked tile is defensible in a *menu*, where the shape of the product is
 * part of what the menu is for. It is not defensible in a panel called Quick
 * Actions, whose entire promise is that clicking does something. So this row
 * holds live routes only, and the roadmap stays in the one place that is
 * honest about being a roadmap.
 *
 * The `to` values are typed as `RoutePath` — derived from the generated route
 * tree — so a tile pointing at a path the router cannot reach is a compile
 * error rather than a dead end a learner finds first.
 */
const ACTIONS: { id: string; label: string; icon: IconName; to: RoutePath }[] = [
  { id: 'review', label: 'Review now', icon: 'refresh-cw', to: '/review' },
  { id: 'tutor', label: 'AI tutor', icon: 'bot', to: '/practice' },
  { id: 'read', label: 'Reading feed', icon: 'languages', to: '/read' },
  { id: 'courses', label: 'Browse courses', icon: 'book-open', to: '/courses' },
  { id: 'leagues', label: 'Leaderboard', icon: 'trophy', to: '/leagues' },
  { id: 'social', label: 'Community', icon: 'users', to: '/social' },
];

export function QuickActionsRow() {
  return (
    <section className="card actions-row-card glass" aria-labelledby="actions-heading">
      <h2 className="card-title" id="actions-heading">
        Quick actions
      </h2>

      {/*
        Horizontal strip, not a grid. The dashboard's main column is already a
        wide 12-col track, and a row of side-by-side tiles reads as the
        "jumps" the design asks for. Scrolls horizontally on a narrow viewport
        rather than wrapping into a tall stack — six tiles stacked vertically
        inside a card is the layout the side column used to have, and it was
        the wrong shape.
      */}
      <ul className="actions-row">
        {ACTIONS.map((action) => (
          <li key={action.id}>
            <Link className="action-row-tile" to={action.to}>
              <span className="action-row-icon" aria-hidden="true">
                <Icon name={action.icon} size={18} />
              </span>
              <span className="action-row-label">{action.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}