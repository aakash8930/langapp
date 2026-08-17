import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { fetchPlans } from '../../api';
import './plans.css';

/** Public MVP access page. No checkout control is rendered while payments are disabled. */
export function PlansPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['billing', 'plans'],
    queryFn: fetchPlans,
  });
  const plan = data?.plans[0];

  return (
    <div className="plans-page">
      <div className="plans-hero">
        <h1 className="plans-heading">GENKŌ is free during the public MVP</h1>
        <p className="plans-subtitle">
          Every currently released learning feature is available without a card, trial, or automatic renewal.
        </p>
      </div>

      <div className="plans-grid">
        <div className="plan-card plan-card--featured">
          <span className="plan-badge">PUBLIC MVP</span>
          <h2 className="plan-name">{plan?.name ?? 'Free access'}</h2>
          <div className="plan-price"><span className="plan-price-value">Free</span></div>
          {isLoading ? <p>Loading included features…</p> : isError ? (
            <p>The feature list is temporarily unavailable. Access remains free.</p>
          ) : (
            <ul className="plan-features">
              {plan?.features.map((feature) => <li key={feature} className="plan-feature">{feature}</li>)}
            </ul>
          )}
          <Link className="plan-cta btn-primary" to="/signup">Create a free account</Link>
        </div>
      </div>

      <div className="plans-trust">
        <p>No payment method · No trial expiry · No purchase or refund flow</p>
      </div>
    </div>
  );
}
