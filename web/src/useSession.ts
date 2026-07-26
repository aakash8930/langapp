import { useCallback, useEffect, useState } from 'react';

import { fetchMe, fetchProgress, login, register, type Progress } from './api';
import { clearTokens, getTokens, onSessionExpired, setTokens, type User } from './auth';

export type Session =
  | { state: 'loading' }
  | { state: 'signedOut' }
  | { state: 'signedIn'; user: User; progress: Progress | null };

/**
 * Who is signed in, and how they are doing.
 *
 * Progress is refetched whenever `refresh()` is called — after finishing a
 * lesson, mainly. It is deliberately not refetched on every render or on a
 * timer: XP only moves when this tab does something.
 */
export function useSession() {
  const [session, setSession] = useState<Session>({ state: 'loading' });

  const load = useCallback(async () => {
    if (!getTokens()) {
      setSession({ state: 'signedOut' });
      return;
    }

    try {
      // Both in flight together — they are independent, and the header wants
      // each as soon as it lands.
      const [user, progress] = await Promise.all([fetchMe(), fetchProgress()]);
      setSession({ state: 'signedIn', user, progress });
    } catch {
      // A 401 has already cleared the tokens via onSessionExpired. Anything
      // else (server asleep) also lands here — signed out is the honest state
      // to show, and the sign-in form says what went wrong when they retry.
      setSession({ state: 'signedOut' });
    }
  }, []);

  useEffect(() => {
    void load();
    return onSessionExpired(() => setSession({ state: 'signedOut' }));
  }, [load]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await login({ email, password });
      setTokens(result.tokens);
      await load();
    },
    [load],
  );

  const signUp = useCallback(
    async (email: string, password: string, displayName: string, dateOfBirth: string) => {
      const result = await register({
        email,
        password,
        displayName,
        // Required since the age gate landed — the server refuses under-13s and
        // cannot retrofit a birth date onto an account created without one.
        dateOfBirth,
        // The server needs a zone to decide what "today" means for the streak;
        // the browser is the only thing that knows it.
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setTokens(result.tokens);
      await load();
    },
    [load],
  );

  const signOut = useCallback(() => {
    clearTokens();
    setSession({ state: 'signedOut' });
  }, []);

  const refreshProgress = useCallback(async () => {
    if (!getTokens()) return;
    try {
      const progress = await fetchProgress();
      setSession((current) =>
        current.state === 'signedIn' ? { ...current, progress } : current,
      );
    } catch {
      // Stale XP on screen is better than an error where the number was.
    }
  }, []);

  return { session, signIn, signUp, signOut, refreshProgress };
}
