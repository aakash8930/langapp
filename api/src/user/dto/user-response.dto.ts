import { Theme, UserDocument } from '../schemas/user.schema';

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
  profile: {
    displayName: string;
    nativeLanguage: string;
    activeTrack: 'ja';
  };
  gamification: {
    xp: number;
    streakDays: number;
    lastStudyDate: string | null;
    dailyGoalXp: number;
  };
  settings: {
    audioSpeed: number;
    theme: Theme;
    tz: string;
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
}

export function toUserResponse(user: UserDocument): UserResponse {
  return {
    id: user._id.toString(),
    email: user.email,
    isAdmin: !!user.isAdmin,
    createdAt: user.get('createdAt') as Date,
    profile: {
      displayName: user.profile.displayName,
      nativeLanguage: user.profile.nativeLanguage,
      activeTrack: user.profile.activeTrack,
    },
    gamification: {
      xp: user.gamification.xp,
      streakDays: user.gamification.streakDays,
      lastStudyDate: user.gamification.lastStudyDate,
      dailyGoalXp: user.gamification.dailyGoalXp,
    },
    settings: {
      audioSpeed: user.settings.audioSpeed,
      theme: user.settings.theme,
      tz: user.settings.tz,
      leaderboardOptIn: user.settings.leaderboardOptIn,
    },
    learningState: {
      knownKana: user.learningState?.knownKana ?? [],
    },
  };
}
