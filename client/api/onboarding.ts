import type { User } from './auth';
import { api } from './client';

/** Mirrors `OnboardingDto` in `api/src/user/dto/onboarding.dto.ts`. */
export type OnboardingPatch = {
  /** Which step to resume at next launch if the wizard is closed mid-way. */
  step?: number;
  nativeLanguage?: string;
  proficiencyLevel?: string;
  learningGoals?: string[];
  learningStyle?: string;
  preferredStudyTime?: string;
  notificationsEnabled?: boolean;
  /** Server bounds: 5–120. */
  studyTimeMinutes?: number;
  /**
   * Server bounds: 10–1000. Writes the same `gamification.dailyGoalXp` field
   * `SettingsPatch.dailyGoalXp` (`api/settings.ts`) does — one field, two
   * endpoints that can touch it, same as `nativeLanguage` below and
   * `profile.nativeLanguage`.
   */
  dailyGoalXp?: number;
  onboardingComplete?: boolean;
};

/**
 * Returns the whole user, same contract as `updateSettings` — replace, don't merge.
 */
export function updateOnboarding(patch: OnboardingPatch): Promise<User> {
  return api.patch<User>('/me/onboarding', patch);
}
