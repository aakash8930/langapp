import { Link } from '@tanstack/react-router';
import { Icon } from '../ui/Icon';

/**
 * Public-MVP access status. Checkout is intentionally disabled, so the
 * dashboard must not advertise an upgrade or imply that released lessons are
 * paywalled.
 */
export function UpgradePremium() {
  return (
    <section className="card upgrade-card glass" aria-labelledby="access-heading">
      <div className="placeholder-head">
        <h2 className="card-title" id="access-heading">
          <span className="card-title-icon" aria-hidden="true">
            <Icon name="check" size={18} />
          </span>
          Free MVP access
        </h2>
      </div>
      <p className="placeholder-note">
        Every released learning feature is available without a payment card or trial expiry.
      </p>
      <ul className="upgrade-perks">
        <li>All released lessons</li>
        <li>FSRS reviews</li>
        <li>AI Tutor</li>
        <li>Synced progress</li>
      </ul>
      <Link
        className="btn btn-primary"
        style={{ marginTop: 'auto', fontSize: 'var(--text-small)' }}
        to="/courses"
      >
        Continue learning
      </Link>
    </section>
  );
}
