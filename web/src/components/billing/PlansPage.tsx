import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  createCheckoutSession,
  fetchPlans,
  type Plan,
} from '../../api';
import { useSession } from '../../useSession';
import './plans.css';

export function PlansPage() {
  const { session } = useSession();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const { data, isLoading } = useQuery({
    queryKey: ['billing', 'plans'],
    queryFn: fetchPlans,
  });

  const plans = data?.plans ?? [];
  const currentPlan = session.state === 'signedIn'
    ? session.user.subscription?.plan ?? 'free'
    : null;

  const checkout = useMutation({
    mutationFn: ({ planId, cycle }: { planId: string; cycle: 'monthly' | 'yearly' }) =>
      createCheckoutSession(planId, cycle),
    onSuccess: (result) => {
      window.location.href = result.url;
    },
  });

  return (
    <div className="plans-page">
      <div className="plans-hero">
        <h1 className="plans-heading">Choose Your Plan</h1>
        <p className="plans-subtitle">
          Select the perfect plan for your Japanese learning journey. Upgrade or downgrade anytime.
        </p>

        <div className="plans-toggle">
          <button
            type="button"
            className={`plans-toggle-option ${billingCycle === 'monthly' ? 'plans-toggle--active' : ''}`}
            onClick={() => setBillingCycle('monthly')}
          >
            Monthly
          </button>
          <button
            type="button"
            className={`plans-toggle-option ${billingCycle === 'yearly' ? 'plans-toggle--active' : ''}`}
            onClick={() => setBillingCycle('yearly')}
          >
            Yearly
            <span className="plans-save-badge">Save 20%</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="plans-grid">
          {[0, 1, 2].map((i) => (
            <div key={i} className="plan-card skeleton" />
          ))}
        </div>
      ) : (
        <div className="plans-grid">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              billingCycle={billingCycle}
              isCurrent={currentPlan === plan.id}
              onSelect={(cycle) => checkout.mutate({ planId: plan.id, cycle })}
              disabled={checkout.isPending || plan.id === 'free' || currentPlan === plan.id}
              isSignedIn={session.state === 'signedIn'}
            />
          ))}
        </div>
      )}

      <div className="plans-trust">
        <p>30-day money-back guarantee · Cancel anytime · Secure payment</p>
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  billingCycle,
  isCurrent,
  onSelect,
  disabled,
  isSignedIn,
}: {
  plan: Plan;
  billingCycle: 'monthly' | 'yearly';
  isCurrent: boolean;
  onSelect: (cycle: 'monthly' | 'yearly') => void;
  disabled: boolean;
  isSignedIn: boolean;
}) {
  const price = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
  const priceDisplay = price === null ? 'Custom' : price === 0 ? 'Free' : `¥${price.toLocaleString()}`;
  const period = price === null || price === 0 ? '' : `/${billingCycle === 'yearly' ? 'yr' : 'mo'}`;

  let buttonLabel: string;
  if (isCurrent) buttonLabel = 'Current Plan';
  else if (plan.id === 'enterprise') buttonLabel = 'Contact Sales';
  else if (plan.id === 'free') buttonLabel = isSignedIn ? 'Current Plan' : 'Get Started';
  else buttonLabel = 'Upgrade';

  return (
    <div className={`plan-card ${plan.highlighted ? 'plan-card--featured' : ''}`}>
      {plan.highlighted && <span className="plan-badge">Most Popular</span>}
      <h2 className="plan-name">{plan.name}</h2>
      <div className="plan-price">
        <span className="plan-price-value">{priceDisplay}</span>
        <span className="plan-price-period">{period}</span>
      </div>
      <ul className="plan-features">
        {plan.features.map((f) => (
          <li key={f} className="plan-feature">{f}</li>
        ))}
      </ul>
      <button
        className={`plan-cta ${plan.highlighted ? 'btn-primary' : 'btn-secondary'}`}
        disabled={disabled}
        onClick={() => onSelect(billingCycle)}
      >
        {buttonLabel}
      </button>
    </div>
  );
}
