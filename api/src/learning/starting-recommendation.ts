export type StartingRecommendation = {
  unit: string;
  title: string;
  requestedLevel: string;
  availableLevel: 'beginner' | 'n5' | 'n4';
  goal: string;
  fallback: boolean;
  reason: string;
};

type OnboardingProfile = {
  proficiencyLevel?: string;
  learningGoals?: string[];
};

const GOAL_LABELS: Record<string, string> = {
  conversation: 'speaking with confidence',
  reading: 'reading Japanese',
  travel: 'preparing for travel',
  jlpt: 'passing the JLPT',
  work: 'using Japanese at work',
};

const UNITS = {
  beginner: { unit: 'hiragana-basics', title: 'Hiragana foundations' },
  n5: {
    reading: { unit: 'kanji-basics', title: 'First kanji' },
    jlpt: { unit: 'grammar-basics', title: 'First sentences' },
    default: { unit: 'vocab-basics', title: 'First words' },
  },
  n4: {
    reading: { unit: 'kanji-n4', title: 'N4 kanji' },
    jlpt: { unit: 'grammar-n4', title: 'N4 grammar' },
    default: { unit: 'vocab-n4', title: 'N4 vocabulary' },
  },
} as const;

/**
 * Converts persisted onboarding answers into one deterministic, explainable
 * curriculum target. The seeded catalog currently tops out at N4, so N3–N1 are
 * intentionally and visibly mapped to N4 rather than pretending content exists.
 */
export function startingRecommendation(profile?: OnboardingProfile): StartingRecommendation {
  const requestedLevel = normaliseLevel(profile?.proficiencyLevel);
  const goal = profile?.learningGoals?.[0] || 'conversation';
  const goalLabel = GOAL_LABELS[goal] ?? 'your selected goal';

  if (requestedLevel === 'beginner') {
    return {
      ...UNITS.beginner,
      requestedLevel,
      availableLevel: 'beginner',
      goal,
      fallback: false,
      reason: `You said you are new to Japanese, so kana comes first before the ${goalLabel} track.`,
    };
  }

  const requestedRank = Number(requestedLevel.slice(1));
  const availableLevel = requestedRank <= 4 ? 'n4' : 'n5';
  const fallback = requestedRank < 4;
  const options = availableLevel === 'n4' ? UNITS.n4 : UNITS.n5;
  const selected = goal === 'reading'
    ? options.reading
    : goal === 'jlpt'
      ? options.jlpt
      : options.default;

  const fallbackText = fallback
    ? ` The current seeded course ends at N4, so this is the highest available match for ${requestedLevel.toUpperCase()}.`
    : '';

  return {
    ...selected,
    requestedLevel,
    availableLevel,
    goal,
    fallback,
    reason: `Your ${requestedLevel.toUpperCase()} starting level and goal of ${goalLabel} point to ${selected.title}.${fallbackText}`,
  };
}

function normaliseLevel(level?: string): 'beginner' | 'n5' | 'n4' | 'n3' | 'n2' | 'n1' {
  const normalised = level?.toLowerCase();
  return normalised === 'n5' || normalised === 'n4' || normalised === 'n3'
    || normalised === 'n2' || normalised === 'n1'
    ? normalised
    : 'beginner';
}
