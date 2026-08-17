import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';

import { fetchMe, fetchProgress, login, logoutBrowser, type Progress } from './api';
import { onSessionExpired, type User } from './auth';
import { log, logError } from './debug';
import { queryKeys } from './queryKeys';

export type Session =
  | { state: 'loading' }
  | { state: 'signedOut' }
  | { state: 'signedIn'; user: User; progress: Progress | null };

let lastLoggedState: string | null = null;

/**
 * Browser session state is discovered from `/me`; JavaScript cannot inspect the
 * HttpOnly access/refresh cookies by design. `available` is cache-backed so all
 * hook instances transition together after login, logout, or a rejected refresh.
 */
export function useSession() {
  const queryClient = useQueryClient();
  const availableQuery = useQuery({
    queryKey: queryKeys.session.available,
    queryFn: async () => true,
    initialData: true,
    staleTime: Infinity,
  });
  const available = availableQuery.data;

  const userQuery = useQuery({
    queryKey: queryKeys.session.me,
    queryFn: fetchMe,
    enabled: available,
    retry: false,
  });

  const progressQuery = useQuery({
    queryKey: queryKeys.session.progress,
    queryFn: fetchProgress,
    enabled: available && userQuery.isSuccess,
    retry: false,
  });

  const session: Session = !available || userQuery.isError
    ? { state: 'signedOut' }
    : userQuery.isPending
      ? { state: 'loading' }
      : userQuery.data
        ? { state: 'signedIn', user: userQuery.data, progress: progressQuery.data ?? null }
        : { state: 'signedOut' };

  const sessionState = session.state;
  const hasProgress = session.state === 'signedIn' && session.progress !== null;
  const userError = userQuery.error;

  useEffect(() => {
    const fingerprint = `${sessionState}:${hasProgress}`;
    if (fingerprint === lastLoggedState) return;
    lastLoggedState = fingerprint;

    if (sessionState === 'signedOut' && userError) {
      logError('auth', 'session dropped to signedOut — /me was rejected', { error: userError });
      return;
    }
    log('auth', `session → ${sessionState}`, { hasProgress });
  }, [sessionState, hasProgress, userError]);

  useEffect(() => onSessionExpired(() => {
    queryClient.setQueryData(queryKeys.session.available, false);
    queryClient.removeQueries({ queryKey: queryKeys.session.me });
    queryClient.removeQueries({ queryKey: queryKeys.session.progress });
  }), [queryClient]);

  const establishSession = useCallback((user: User) => {
    queryClient.setQueryData(queryKeys.session.available, true);
    queryClient.setQueryData(queryKeys.session.me, user);
    void queryClient.invalidateQueries({ queryKey: queryKeys.session.progress });
  }, [queryClient]);

  const signInMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      login({ email, password }),
    onSuccess: ({ user }) => establishSession(user),
  });

  const signOut = useCallback(() => {
    // Start the server-side revocation while the readable CSRF cookie still
    // exists, then clear all user-derived browser state immediately.
    void logoutBrowser().catch((error) => {
      logError('auth', 'server logout failed; local session was still cleared', { error });
    });
    queryClient.setQueryData(queryKeys.session.available, false);
    queryClient.removeQueries({ queryKey: queryKeys.session.me });
    queryClient.removeQueries({ queryKey: queryKeys.session.progress });
  }, [queryClient]);

  const refreshProgress = useCallback(() => {
    if (!available) return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.session.progress });
  }, [available, queryClient]);

  return {
    session,
    signIn: (email: string, password: string) =>
      signInMutation.mutateAsync({ email, password }).then(() => undefined),
    signOut,
    refreshProgress,
  };
}
