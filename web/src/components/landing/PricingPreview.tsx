import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { fetchPlans, type Plan } from '../../api';

function PlanPricing({ plan, cycle }: { plan: Plan; cycle: 'monthly' | 'yearly' }) {
  const price = cycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
  if (price === null) return <span className="plan-price-text">Custom</span>;
  if (price === 0) return <span className="plan-price-text">Free</span>;
  return <span className="plan-price-text">¥{price.toLocaleString()}<span className="plan-price-period">/{cycle === 'yearly' ? 'yr' : 'mo'}</span></span>;
}

export function PricingPreview() {
  const { data } = useQuery({ queryKey: ['billing', 'plans'], queryFn: fetchPlans });
  const plans = data?.plans ?? [];

  return (
    <section className="landing-section landing-section--alt" id="pricing">
      <div className="landing-container">
        <h2 className="landing-heading">Free public MVP access</h2>
        <p className="landing-subtitle">Use every released learning feature without a card or trial expiry.</p>
        <div className="pricing-preview-grid">
          {plans.map((plan: Plan) => (
            <div key={plan.id} className={`pricing-preview-card glass ${plan.highlighted ? 'pricing-preview-card--featured' : ''}`}>
              <h3 className="pricing-preview-name">{plan.name}</h3>
              <PlanPricing plan={plan} cycle="monthly" />
              <ul className="pricing-preview-features">
                {plan.features.slice(0, 5).map((f: string) => <li key={f}>{f}</li>)}
                {plan.features.length > 5 && <li className="pricing-more">+{plan.features.length - 5} more</li>}
              </ul>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 'var(--s-lg)' }}>
          <Link className="btn btn-primary" to="/plans">See what is included</Link>
        </div>
      </div>
    </section>
  );
}
