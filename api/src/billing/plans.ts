export const PLANS = [
  {
    id: 'free',
    name: 'Public MVP',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      'Complete Japanese course',
      'Vocabulary, grammar, kana, and kanji libraries',
      'Lesson quizzes and checkpoints',
      'Progress, XP, streaks, and social practice',
      'AI tutor and Japanese audio when configured',
      'No payment method required',
    ],
  },
] as const;

/** Public MVP accepts no paid checkout. Historical account values remain in the user schema. */
export type PlanId = (typeof PLANS)[number]['id'];
