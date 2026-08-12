import { Link } from '@tanstack/react-router';

import { Icon } from '../ui/Icon';

/** Live community destinations; no activity or reaction counts are fabricated. */
export function CommunityFeed() {
  return (
    <section className="card community-card glass" aria-labelledby="community-heading">
      <div className="dashboard-section-head">
        <h2 id="community-heading">Community feed</h2>
        <Link to="/social">View all</Link>
      </div>
      <ul className="community-link-list">
        <li>
          <Link to="/social">
            <span className="community-link-icon"><Icon name="users" size={17} /></span>
            <span><strong>Friends &amp; messages</strong><small>Study together</small></span>
            <Icon name="chevron-right" size={14} />
          </Link>
        </li>
        <li>
          <Link to="/leagues">
            <span className="community-link-icon"><Icon name="trophy" size={17} /></span>
            <span><strong>Weekly leaderboard</strong><small>See your league</small></span>
            <Icon name="chevron-right" size={14} />
          </Link>
        </li>
        <li>
          <Link to="/challenges">
            <span className="community-link-icon"><Icon name="flame" size={17} /></span>
            <span><strong>Community challenges</strong><small>Keep your momentum</small></span>
            <Icon name="chevron-right" size={14} />
          </Link>
        </li>
      </ul>
    </section>
  );
}
