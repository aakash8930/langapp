import { FontSize, Theme, UserDocument } from '../schemas/user.schema';

/**
 * The only shape a user is ever allowed to leave the API in.
 * Built by explicit field copy — an allowlist, so a field added to the schema
 * later cannot leak by default (§ "don't return passwordHash ever").
 */
export interface UserResponse {
  id: string;
  email: string;
  isAdmin: boolean;
  createdAt: Date;
  avatarUrl: string | null;
  totpEnabled: boolean;
  emailVerified: boolean;
  profile: {
    displayName: string;
    bio: string;
    nativeLanguage: string;
    activeTrack: 'ja';
  };
  gamification: {
    xp: number;
    streakDays: number;
    lastStudyDate: string | null;
    dailyGoalXp: number;
    leagueTier: number;
  };
  settings: {
    audioSpeed: number;
    theme: Theme;
    tz: string;
    fontSize: FontSize;
    /**
     * Off by default. Phase 2 §3.2 makes the weekly leaderboard opt-in, so a
     * learner who does not want the surface can switch it off — and the field
     * being here means Settings can both read and write it through the same
     * DTO.
     */
    leaderboardOptIn: boolean;
  };
  learningState: {
    /** Characters this learner has been taught; used by the reading surface. */
    knownKana: string[];
  };
  onboardingState: {
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
  notificationSettings: {
    studyReminders: boolean;
    achievements: boolean;
    community: boolean;
    eventsUpdates: boolean;
    marketing: boolean;
    emailDailyGoal: boolean;
    emailWeeklyDigest: boolean;
    emailMarketing: boolean;
  };
  subscription: {
    plan: string;
    status: string;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
  };
}

export function toUserResponse(user: UserDocument): UserResponse {
  return {
    id: user._id.toString(),
    email: user.email,
    isAdmin: !!user.isAdmin,
    createdAt: user.get('createdAt') as Date,
    avatarUrl: user.avatarUrl ?? null,
    totpEnabled: !!user.totpEnabled,
    emailVerified: !!user.emailVerified,
    profile: {
      displayName: user.profile.displayName,
      bio: user.profile.bio ?? '',
      nativeLanguage: user.profile.nativeLanguage,
      activeTrack: user.profile.activeTrack,
    },
    gamification: {
      xp: user.gamification.xp,
      streakDays: user.gamification.streakDays,
      lastStudyDate: user.gamification.lastStudyDate,
      dailyGoalXp: user.gamification.dailyGoalXp,
      leagueTier: user.gamification.leagueTier ?? 0,
    },
    settings: {
      audioSpeed: user.settings.audioSpeed,
      theme: user.settings.theme,
      tz: user.settings.tz,
      fontSize: user.settings.fontSize ?? 'medium',
      leaderboardOptIn: user.settings.leaderboardOptIn,
    },
    learningState: {
      knownKana: user.learningState?.knownKana ?? [],
    },
    onboardingState: {
      onboardingComplete: !!user.onboardingState?.onboardingComplete,
      onboardingStep: user.onboardingState?.onboardingStep ?? 0,
      targetLanguage: user.onboardingState?.targetLanguage ?? 'ja',
      proficiencyLevel: user.onboardingState?.proficiencyLevel ?? '',
      learningGoals: user.onboardingState?.learningGoals ?? [],
      learningStyle: user.onboardingState?.learningStyle ?? '',
      preferredStudyTime: user.onboardingState?.preferredStudyTime ?? '',
      notificationsEnabled: !!user.onboardingState?.notificationsEnabled,
      studyTimeMinutes: user.onboardingState?.studyTimeMinutes ?? 15,
      placementTestCompleted: !!user.onboardingState?.placementTestCompleted,
      placementTestScore: user.onboardingState?.placementTestScore ?? null,
      placementTestLevel: user.onboardingState?.placementTestLevel ?? '',
    },
    notificationSettings: {
      studyReminders: user.notificationSettings?.studyReminders ?? false,
      achievements: user.notificationSettings?.achievements ?? true,
      community: user.notificationSettings?.community ?? true,
      eventsUpdates: user.notificationSettings?.eventsUpdates ?? true,
      marketing: user.notificationSettings?.marketing ?? false,
      emailDailyGoal: user.notificationSettings?.emailDailyGoal ?? false,
      emailWeeklyDigest: user.notificationSettings?.emailWeeklyDigest ?? false,
      emailMarketing: user.notificationSettings?.emailMarketing ?? false,
    },
    subscription: {
      plan: user.subscription?.plan ?? 'free',
      status: user.subscription?.status ?? 'active',
      currentPeriodEnd: user.subscription?.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: !!user.subscription?.cancelAtPeriodEnd,
    },
  };
}
