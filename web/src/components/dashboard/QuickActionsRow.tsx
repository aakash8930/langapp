import { Link } from '@tanstack/react-router';

import type { RoutePath } from '../../types/layout';
import { Icon, type IconName } from '../ui/Icon';

const ACTIONS: {
  id: string;
  label: string;
  note: string;
  icon: IconName;
  to: RoutePath;
}[] = [
  { id: 'tutor', label: 'AI tutor', note: 'Ask anything', icon: 'bot', to: '/practice' },
  { id: 'vocabulary', label: 'Vocabulary', note: 'Learn new words', icon: 'library', to: '/vocabulary' },
  { id: 'review', label: 'Review', note: 'Spaced repetition', icon: 'refresh-cw', to: '/review' },
  { id: 'courses', label: 'Courses', note: 'Continue your path', icon: 'book-open', to: '/courses' },
  { id: 'planner', label: 'Progress', note: 'See your learning', icon: 'calendar', to: '/progress' },
  { id: 'more', label: 'More', note: 'All practice', icon: 'ellipsis', to: '/practice-hub' },
];

export function QuickActionsRow() {
  return (
    <section className="dashboard-section actions-row-card" aria-labelledby="actions-heading">
      <div className="dashboard-section-head">
        <h2 id="actions-heading">Quick actions</h2>
      </div>
      <ul className="actions-row">
        {ACTIONS.map((action) => (
          <li key={action.id}>
            <Link className="action-row-tile" to={action.to}>
              <span className="action-row-icon" aria-hidden="true">
                <Icon name={action.icon} size={22} />
              </span>
              <span className="action-row-copy">
                <strong className="action-row-label">{action.label}</strong>
                <small>{action.note}</small>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
