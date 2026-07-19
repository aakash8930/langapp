import { UserDocument } from '../schemas/user.schema';

/**
 * The only shape a user is ever allowed to leave the API in.
 * Built by explicit field copy — an allowlist, so a field added to the schema
 * later cannot leak by default (§ "don't return passwordHash ever").
 */
export interface UserResponse {
  id: string;
  email: string;
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
    theme: 'light' | 'dark';
    tz: string;
  };
}

export function toUserResponse(user: UserDocument): UserResponse {
  return {
    id: user._id.toString(),
    email: user.email,
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
    },
  };
}
