import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  fetchMe,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
  type EmailDelivery,
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
  /** Transient queue outcome from this device's most recent registration. */
  registrationDelivery: EmailDelivery | null;
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
  const [registrationDelivery, setRegistrationDelivery] = useState<EmailDelivery | null>(null);

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

        // A network failure says nothing about whether the saved session is
        // valid, so keep its tokens. The app layout shows a retry/sign-out gate
        // until authoritative verification and onboarding state can load.
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
        setRegistrationDelivery(null);
        setUser(null);
        setStatus('unauthenticated');
      }),
    [],
  );

  const register = useCallback(async (input: RegisterInput) => {
    const result = await registerRequest(input);
    setUser(result.user);
    setRegistrationDelivery(result.emailDelivery ?? null);
    setStatus('authenticated');
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const me = await loginRequest(input);
    setRegistrationDelivery(null);
    setUser(me);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setRegistrationDelivery(null);
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
    () => ({ status, user, registrationDelivery, register, login, logout, applyUser, refresh }),
    [status, user, registrationDelivery, register, login, logout, applyUser, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
