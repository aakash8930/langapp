import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';

import {
  fetchMe,
  fetchProgress,
  login,
  register,
  type Progress,
} from './api';
import {
  clearTokens,
  getTokens,
  onSessionExpired,
  setTokens,
  type Tokens,
  type User,
} from './auth';
import { log, logError } from './debug';
import { queryKeys } from './queryKeys';

export type Session =
  | { state: 'loading' }
  | { state: 'signedOut' }
  | { state: 'signedIn'; user: User; progress: Progress | null };

/**
 * The last session state written to the console, at module scope on purpose.
 *
 * `useSession()` is called by the shell and by most screens, each with its own
 * hook instance — a per-component ref would log the same transition once per
 * caller. There is only one session, so there should be one line per change.
 */
let lastLoggedState: string | null = null;

/**
 * The login/register mutations live outside the hook so their `onSuccess` can
 * flip the session and prime the cache *before* the screen that called them
 * re-renders. Returning them from a hook works too but spreads the same logic
 * across every call site; this is the cleaner shape.
 *
 * `useSession()` then reads the resulting user/progress from the cache and
 * renders the same state machine as before — `loading` / `signedOut` /
 * `signedIn` — so the screens that consume it don't change.
 */
export function useSession() {
  const queryClient = useQueryClient();
  const tokens = getTokens();

  const userQuery = useQuery({
    queryKey: queryKeys.session.me,
    queryFn: fetchMe,
    enabled: tokens !== null,
  });

  const progressQuery = useQuery({
    queryKey: queryKeys.session.progress,
    queryFn: fetchProgress,
    enabled: tokens !== null,
  });

  /*
   * The session state machine has three values. The query cache has two
   * signals: a `user` row and a `progress` row. Map them:
   *
   *   - no tokens                            → `signedOut`
   *   - tokens, user is still on the wire    → `loading`
   *   - tokens, user query errored                     → `signedOut`
   *     (a 401 has already cleared tokens via `onSessionExpired`)
   *   - tokens, user is cached, any progress state    → `signedIn`
   *
   * `progress` is `null` for the first render of `signedIn`; the header
   * currently shows the XP / streak off `progress`, so a brief flicker of
   * the header at sign-in is acceptable and the screen-level consumers
   * (`LessonQuiz`) already handle `null` for `completedLessonIds`.
   */
  const session: Session = !tokens
    ? { state: 'signedOut' }
    : userQuery.isPending
      ? { state: 'loading' }
      : userQuery.isError || !userQuery.data
        ? { state: 'signedOut' }
        : { state: 'signedIn', user: userQuery.data, progress: progressQuery.data ?? null };

  /*
   * Trace the state machine on transition, not on render.
   *
   * `signedOut` has two very different causes that render identically — no
   * tokens at all, and tokens whose `/me` call failed — so the reason is part of
   * the line. That distinction is the difference between "you are not logged in"
   * and "your session broke", and the screen says the same thing for both.
   */
  const signedOutReason = !tokens
    ? 'no tokens'
    : userQuery.isError
      ? 'the /me request failed'
      : !userQuery.data
        ? '/me returned nothing'
        : null;

  // Primitives, not `session` itself. The session object is rebuilt every
  // render, so depending on it would run this effect every render — harmless
  // given the fingerprint guard below, but it is the kind of dependency that
  // stops being harmless the moment someone adds a second statement here.
  const sessionState = session.state;
  const hasProgress = session.state === 'signedIn' && session.progress !== null;
  const cardsDueNow = session.state === 'signedIn' ? (session.progress?.cardsDueNow ?? null) : null;
  const hasTokens = tokens !== null;
  const userError = userQuery.error;

  useEffect(() => {
    const fingerprint = `${sessionState}:${signedOutReason ?? ''}:${hasProgress}`;
    if (fingerprint === lastLoggedState) return;
    lastLoggedState = fingerprint;

    if (sessionState === 'signedOut' && hasTokens) {
      logError('auth', `session dropped to signedOut — ${signedOutReason}`, { error: userError });
      return;
    }

    log('auth', `session → ${sessionState}`, {
      reason: signedOutReason,
      hasProgress,
      cardsDueNow,
    });
  }, [sessionState, signedOutReason, hasProgress, cardsDueNow, hasTokens, userError]);

  // A 401 that `authed()` couldn't recover has already cleared the tokens and
  // any cached user/progress. Listen so our queries stop re-trying with a
  // stale cache.
  useEffect(() => {
    return onSessionExpired(() => {
      queryClient.removeQueries({ queryKey: queryKeys.session.me });
      queryClient.removeQueries({ queryKey: queryKeys.session.progress });
    });
  }, [queryClient]);

  const signInMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      login({ email, password }),
    onSuccess: ({ user, tokens: newTokens }: { user: User; tokens: Tokens }) => {
      setTokens(newTokens);
      // Prime the cache so the next render reads `signedIn` from the data
      // rather than waiting for a stale-while-revalidate hit.
      queryClient.setQueryData(queryKeys.session.me, user);
      // Progress is user-derived and just changed; force a fresh fetch on
      // the next read so the header doesn't flash a stale XP from a
      // previous session.
      queryClient.invalidateQueries({ queryKey: queryKeys.session.progress });
    },
  });

  const signUpMutation = useMutation({
    mutationFn: (body: {
      email: string;
      password: string;
      displayName: string;
      dateOfBirth: string;
    }) =>
      register({
        ...body,
        // The server needs a zone to decide what "today" means for the streak;
        // the browser is the only thing that knows it.
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    onSuccess: ({ user, tokens: newTokens }: { user: User; tokens: Tokens }) => {
      setTokens(newTokens);
      queryClient.setQueryData(queryKeys.session.me, user);
      queryClient.invalidateQueries({ queryKey: queryKeys.session.progress });
    },
  });

  const signOut = useCallback(() => {
    clearTokens();
    queryClient.removeQueries({ queryKey: queryKeys.session.me });
    queryClient.removeQueries({ queryKey: queryKeys.session.progress });
  }, [queryClient]);

  const refreshProgress = useCallback(() => {
    if (!tokens) return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.session.progress });
  }, [queryClient, tokens]);

  return {
    session,
    signIn: (email: string, password: string) =>
      signInMutation.mutateAsync({ email, password }).then(() => undefined),
    signUp: (email: string, password: string, displayName: string, dateOfBirth: string) =>
      signUpMutation
        .mutateAsync({ email, password, displayName, dateOfBirth })
        .then(() => undefined),
    signOut,
    refreshProgress,
  };
}
