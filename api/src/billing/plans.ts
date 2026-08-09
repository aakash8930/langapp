export const PLANS = [
  {
    id: 'free',
    name: 'Free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      'Basic lessons',
      'Limited vocabulary',
      'Grammar exercises',
      'Basic progress tracking',
      'Community forum',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 980,
    yearlyPrice: 9800,
    features: [
      'Unlimited lessons',
      'Advanced vocabulary',
      'Grammar exercises',
      'AI Tutor',
      'Advanced analytics',
      'Offline mode',
      'Speech recognition',
      'Cultural notes',
      'Email support',
    ],
    highlighted: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: null,
    yearlyPrice: null,
    features: [
      'Everything in Pro',
      'Team dashboard',
      'Admin controls',
      'SSO integration',
      'Dedicated support',
      'Custom integrations',
    ],
  },
] as const;

export type PlanId = (typeof PLANS)[number]['id'];
