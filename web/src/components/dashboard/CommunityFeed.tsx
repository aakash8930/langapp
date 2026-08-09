import { Link } from '@tanstack/react-router';

import { Icon } from '../ui/Icon';

/**
 * Community feed — placeholder.
 *
 * ## What is and isn't there
 *
 * Friends and messaging live at `/social` today, but there is no public feed
 * endpoint to back the timeline the design asks for. The card points at the
 * live route so it is not a dead end, and the pill names the gap.
 */
export function CommunityFeed() {
  return (
    <section className="card community-card glass" aria-labelledby="community-heading">
      <div className="placeholder-head">
        <h2 className="card-title" id="community-heading">
          <span className="card-title-icon" aria-hidden="true">
            <Icon name="users" size={18} />
          </span>
          Community
        </h2>
        <span className="placeholder-pill">Coming soon</span>
      </div>
      <p className="placeholder-note">
        The feed isn&rsquo;t built yet — friends and messages live in
        <Link className="card-link" to="/social">
          {' '}
          /social
        </Link>
        .
      </p>
    </section>
  );
}