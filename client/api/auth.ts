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
};

type AuthResponse = {
  user: User;
  tokens: Tokens & { expiresIn: number };
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
};

export type LoginInput = {
  email: string;
  password: string;
};

export async function register(input: RegisterInput): Promise<User> {
  const { user, tokens } = await api.post<AuthResponse>('/auth/register', {
    ...input,
    // The device timezone drives streak roll-over, which the server computes.
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  await setTokens(tokens);
  return user;
}

export async function login(input: LoginInput): Promise<User> {
  const { user, tokens } = await api.post<AuthResponse>('/auth/login', input);
  await setTokens(tokens);
  return user;
}

export function fetchMe(): Promise<User> {
  return api.get<User>('/me');
}

/**
 * There is no server-side logout — refresh tokens live in Redis keyed by jti
 * and expire on their own. Dropping the tokens from the Keychain is the whole
 * of it, so this cannot fail on a dead network.
 */
export async function logout(): Promise<void> {
  await clearTokens();
}
