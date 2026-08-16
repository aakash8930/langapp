/** Browser session events. Credentials live only in server-issued HttpOnly cookies. */

// One-time migration cleanup: older builds persisted bearer credentials here.
// They are never read now, and leaving them behind would preserve the XSS risk
// until their natural expiry for users who upgraded in place.
try {
  localStorage.removeItem('langapp.accessToken');
  localStorage.removeItem('langapp.refreshToken');
} catch {
  // Storage may be blocked; cookie sessions still work.
}

export type User = {
  id: string;
  email: string;
  isAdmin?: boolean;
  avatarUrl?: string | null;
  createdAt?: string;
  totpEnabled?: boolean;
  emailVerified?: boolean;
  profile: { displayName: string; bio?: string; nativeLanguage: string; activeTrack: string };
  gamification: {
    xp: number;
    streakDays: number;
    lastStudyDate: string | null;
    dailyGoalXp: number;
    leagueTier?: number;
  };
  settings: {
    audioSpeed: number;
    theme: string;
    tz: string;
    fontSize?: string;
    leaderboardOptIn: boolean;
  };
  learningState: { knownKana: string[] };
  onboardingState?: {
    onboardingComplete: boolean;
    onboardingStep: number;
    targetLanguage: string;
    proficiencyLevel: string;
    learningGoals: string[];
    learningStyle: string;
    preferredStudyTime: string;
    notificationsEnabled: boolean;
    studyTimeMinutes: number;
    placementTestCompleted: boolean;
    placementTestScore: number | null;
    placementTestLevel: string;
  };
  notificationSettings?: {
    studyReminders: boolean;
    achievements: boolean;
    community: boolean;
    eventsUpdates: boolean;
    marketing: boolean;
    emailDailyGoal: boolean;
    emailWeeklyDigest: boolean;
    emailMarketing: boolean;
  };
  subscription?: {
    plan: string;
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  };
};

const sessionExpiredListeners = new Set<() => void>();

export function onSessionExpired(listener: () => void): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

/** Tell every session consumer that the server rejected the browser session. */
export function emitSessionExpired(): void {
  for (const listener of sessionExpiredListeners) listener();
}
