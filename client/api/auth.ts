import type { ThemePreference } from '@/theme';

import { api } from './client';
import { clearTokens, setTokens, type Tokens } from './session';

/**
 * Auth endpoints.
 *
 * Note the response shape: register and login return `{ user, tokens }`, while
 * refresh returns the token pair flat. The root CLAUDE.md contract documents
 * both correctly as of 2026-07-19.
 */

export type User = {
  id: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
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
    /** 'system' means follow the OS. The server stores it; the client resolves it. */
    theme: ThemePreference;
    tz: string;
    /**
     * Off by default. Phase 2 §3.2 makes the weekly leaderboard opt-in — a
     * learner who does not want a competitive surface does not see one, and
     * opted-out peers are filtered out of the table for everyone else.
     */
    leaderboardOptIn: boolean;
  };
  /** Mirrors `OnboardingState` in `api/src/user/schemas/user.schema.ts`. */
  onboardingState: {
    onboardingComplete: boolean;
    /** Index into the wizard's step list — see `app/(app)/onboarding.tsx`. */
    onboardingStep: number;
    targetLanguage: string;
    proficiencyLevel: string;
    learningGoals: string[];
    learningStyle: string;
    preferredStudyTime: string;
    notificationsEnabled: boolean;
    studyTimeMinutes: number;
    /**
     * Legacy schema fields reserved for a future real placement test. Neither
     * client advertises or writes them while no scored test exists.
     */
    placementTestCompleted: boolean;
    placementTestScore: number | null;
    placementTestLevel: string;
  };
  /**
   * Mirrors `UpdateNotificationSettingsDto` / `toUserResponse`'s
   * `notificationSettings` block. `studyReminders` is the one the server's
   * `ReminderProcessor` actually reads (`'notificationSettings.studyReminders': true`
   * is its query filter) — `onboardingState.notificationsEnabled` above is a
   * separate field the onboarding wizard writes and nothing reads back.
   */
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
};

export type EmailDelivery = {
  status: 'queued' | 'unavailable';
  deliveryId: string;
};

type AuthResponse = {
  user: User;
  tokens: Tokens & { expiresIn: number };
  emailDelivery?: EmailDelivery;
};

export type RegistrationResult = {
  user: User;
  emailDelivery?: EmailDelivery;
};

export type RegisterInput = {
  email: string;
  password: string;
  displayName: string;
  /**
   * ISO 'YYYY-MM-DD'. **Required** — the server refuses registrations below the
   * minimum age, and a birth date cannot be retrofitted onto an account created
   * without one.
   */
  dateOfBirth: string;
  acceptedTerms: true;
};

export type LoginInput = {
  email: string;
  password: string;
};

export async function register(input: RegisterInput): Promise<RegistrationResult> {
  const { user, tokens, emailDelivery } = await api.post<AuthResponse>('/auth/register', {
    ...input,
    // The device timezone drives streak roll-over, which the server computes.
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  await setTokens(tokens);
  return { user, emailDelivery };
}

export async function login(input: LoginInput): Promise<User> {
  const { user, tokens } = await api.post<AuthResponse>('/auth/login', input);
  await setTokens(tokens);
  return user;
}

export function fetchMe(): Promise<User> {
  return api.get<User>('/me');
}

export function verifyEmail(token: string): Promise<{ message: string }> {
  return api.post('/auth/verify-email', { token });
}

export function resendVerification(): Promise<{ message: string }> {
  return api.post('/auth/resend-verification');
}

/**
 * There is no server-side logout — refresh tokens live in Redis keyed by jti
 * and expire on their own. Dropping the tokens from the Keychain is the whole
 * of it, so this cannot fail on a dead network.
 */
export async function logout(): Promise<void> {
  await clearTokens();
}

/**
 * Always resolves with the same generic message, registered address or not —
 * the server burns no distinguishing work either. Never throws for "unknown
 * email"; there is no such error to catch.
 */
export function forgotPassword(email: string): Promise<{ message: string }> {
  return api.post('/auth/forgot-password', { email });
}

/**
 * A wrong code, an expired one and an unknown email are one indistinguishable
 * 401 from the server — do not try to tell them apart in the caller either.
 */
export function resetPassword(
  email: string,
  code: string,
  newPassword: string,
): Promise<{ message: string }> {
  return api.post('/auth/reset-password', { email, code, newPassword });
}

/** Changing the password revokes every session server-side, this one included. */
export function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ message: string }> {
  return api.post('/auth/change-password', { currentPassword, newPassword });
}

/**
 * Deletes the account outright — there is no undo and no confirmation email.
 * The server already revokes every session before returning; the caller still
 * has to drop the local tokens itself (`useAuth().logout()` does exactly that
 * with no extra request, since logout is local-only — see above).
 */
export function deleteAccount(password: string): Promise<{ message: string }> {
  return api.post('/auth/delete-account', { password });
}
