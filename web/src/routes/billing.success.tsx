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
        <h1 className="success-heading">Payment Successful!</h1>
        <p className="success-message">
          Welcome to Pro! You now have full access to all premium features.
        </p>
        <p className="success-note">
          A confirmation email has been sent to your registered email address.
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
