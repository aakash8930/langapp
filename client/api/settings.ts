import type { ThemePreference } from '@/theme';

import type { User } from './auth';
import { api } from './client';

/** Mirrors UpdateSettingsDto in api/src/user/dto/update-settings.dto.ts. */
export type SettingsPatch = {
  audioSpeed?: number;
  theme?: ThemePreference;
  /** IANA zone name. The server rejects anything its tz database doesn't know. */
  tz?: string;
  /** Integer, 10–1000. Stored on `gamification`, patched through here. */
  dailyGoalXp?: number;
};

/** The server's accepted range, mirrored so the client can't send a rejectable value. */
export const MIN_DAILY_GOAL_XP = 10;
export const MAX_DAILY_GOAL_XP = 1000;

/**
 * Returns the **whole user**, not just the settings block — so the caller
 * should replace its user rather than merging a fragment into one.
 */
export function updateSettings(patch: SettingsPatch): Promise<User> {
  return api.patch<User>('/me/settings', patch);
}
