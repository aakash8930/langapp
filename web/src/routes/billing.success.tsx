import { createFileRoute, Link } from '@tanstack/react-router';
import { Icon } from '../components/ui/Icon';
import './billing.success.css';

export const Route = createFileRoute('/billing/success')({
  component: PaymentSuccess,
});

function PaymentSuccess() {
  return (
    <div className="success-page">
      <div className="success-card glass">
        <div className="success-icon">
          <Icon name="check" size={48} />
        </div>
        <h1 className="success-heading">Payment received</h1>
        <p className="success-message">
          We are confirming your payment and updating your subscription securely.
        </p>
        <p className="success-note">
          Premium access is activated only after the billing provider and LangApp backend confirm the transaction. Check Manage Subscription for the current status.
        </p>
        <div className="success-actions">
          <Link className="btn btn-primary" to="/">
            Start Learning
          </Link>
          <Link className="btn btn-secondary" to="/billing">
            Manage Subscription
          </Link>
        </div>
      </div>
    </div>
  );
}
