import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  fetchMe,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
  type LoginInput,
  type RegisterInput,
  type User,
} from '@/api/auth';
import { OfflineError } from '@/api/client';
import { getTokens, onSessionExpired } from '@/api/session';

type Status = 'loading' | 'authenticated' | 'unauthenticated';

type AuthContextValue = {
  status: Status;
  /** Null while loading, and after a launch that could not reach the server. */
  user: User | null;
  register: (input: RegisterInput) => Promise<void>;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  /**
   * Replaces the cached user after something else changes it — settings, so
   * far. `PATCH /me/settings` returns the whole user, so callers hand the whole
   * thing back rather than merging a fragment.
   *
   * This is what makes a theme change visible on the tap rather than on the
   * next launch: the palette is derived from `user.settings.theme`.
   */
  applyUser: (user: User) => void;
  /**
   * Re-reads the profile. The launch path tolerates an unreachable API by
   * letting the app in with a null user, so this is how a screen that actually
   * needs the profile offers a way out of that state without a restart.
   */
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const tokens = await getTokens();
      if (cancelled) return;

      if (!tokens) {
        setStatus('unauthenticated');
        return;
      }

      try {
        const me = await fetchMe();
        if (cancelled) return;
        setUser(me);
        setStatus('authenticated');
      } catch (error) {
        if (cancelled) return;

        // The API runs on a laptop that is off half the time. Being unable to
        // reach it says nothing about whether the session is good, so keep the
        // tokens and let the app in — signing the user out here would mean
        // re-typing a password every time the laptop sleeps.
        if (error instanceof OfflineError) {
          setStatus('authenticated');
          return;
        }

        // Anything else — a 401 survived the refresh-and-retry, so apiFetch has
        // already cleared the tokens and fired onSessionExpired.
        setStatus('unauthenticated');
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(
    () =>
      onSessionExpired(() => {
        setUser(null);
        setStatus('unauthenticated');
      }),
    [],
  );

  const register = useCallback(async (input: RegisterInput) => {
    const me = await registerRequest(input);
    setUser(me);
    setStatus('authenticated');
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const me = await loginRequest(input);
    setUser(me);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const applyUser = useCallback((next: User) => {
    setUser(next);
  }, []);

  const refresh = useCallback(async () => {
    // Deliberately not caught: the caller shows the failure. A 401 is already
    // handled deeper down, where apiFetch clears the session.
    setUser(await fetchMe());
  }, []);

  const value = useMemo(
    () => ({ status, user, register, login, logout, applyUser, refresh }),
    [status, user, register, login, logout, applyUser, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
