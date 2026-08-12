import { Link } from '@tanstack/react-router';
import { useSession } from '../../useSession';
import { Icon } from '../ui/Icon';

export function UpgradePremium() {
  const { session } = useSession();

  if (session.state === 'loading') {
    return (
      <section className="card upgrade-card glass" aria-labelledby="upgrade-heading">
        <div className="placeholder-head">
          <h2 className="card-title" id="upgrade-heading">
            <span className="card-title-icon" aria-hidden="true">
              <Icon name="crown" size={18} />
            </span>
            Upgrade to Premium
          </h2>
        </div>
        <p className="placeholder-note">Loading...</p>
      </section>
    );
  }

  const isPremium =
    session.state === 'signedIn' &&
    session.user.subscription?.status === 'active' &&
    session.user.subscription?.plan !== 'free';

  if (isPremium) {
    return (
      <section className="card upgrade-card glass" aria-labelledby="upgrade-heading">
        <div className="placeholder-head">
          <h2 className="card-title" id="upgrade-heading">
            <span className="card-title-icon" aria-hidden="true">
              <Icon name="crown" size={18} />
            </span>
            You're on Pro
          </h2>
        </div>
        <p className="placeholder-note">
          Enjoying unlimited lessons, AI Tutor, and all premium features.
        </p>
        <Link
          className="btn btn-secondary"
          style={{ marginTop: 'auto', fontSize: 'var(--text-small)' }}
          to="/billing"
        >
          Manage
        </Link>
      </section>
    );
  }

  return (
    <section className="card upgrade-card glass" aria-labelledby="upgrade-heading">
      <div className="placeholder-head">
        <h2 className="card-title" id="upgrade-heading">
          <span className="card-title-icon" aria-hidden="true">
            <Icon name="crown" size={18} />
          </span>
          Upgrade to Premium
        </h2>
      </div>
      <p className="placeholder-note">
        Unlock all courses, advanced AI features, and premium content.
      </p>
      <ul className="upgrade-perks">
        <li>Unlimited lessons</li>
        <li>AI Tutor</li>
        <li>Advanced analytics</li>
        <li>Offline mode</li>
      </ul>
      <Link
        className="btn btn-primary"
        style={{ marginTop: 'auto', fontSize: 'var(--text-small)' }}
        to="/plans"
      >
        Upgrade now
      </Link>
    </section>
  );
}
