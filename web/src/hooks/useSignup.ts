/**
 * Signup mutation hook.
 *
 * Wraps the auth service's `registerAccount` in a TanStack `useMutation` and
 * owns the side effects that belong to a successful registration: priming
 * the browser session and the session cache so the app shell reads `signedIn`
 * without a flash of signed-out state.
 *
 * Error normalisation is handled here too (via `describeSignupError`) so the
 * form renders a plain `string` and never needs to know about `ApiError` or
 * status codes. The form calls `signup(form)` and gets back `true`/`false` —
 * a result means the HttpOnly session was accepted and it is safe to navigate onward.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { describeSignupError, registerAccount, type SignupResult } from '../services/auth.service';
import { queryKeys } from '../queryKeys';
import type { SignupForm } from '../validation/signup.schema';

export interface UseSignupResult {
  signup: (form: SignupForm) => Promise<SignupResult | null>;
  isPending: boolean;
  isError: boolean;
  error: string | null;
}

export function useSignup(): UseSignupResult {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: registerAccount,
    // Reuse the same cache-priming the session hook does, so the signed-in
    // shell reads the new user from cache immediately rather than refetching
    // `/me` and flashing the header at the old state.
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.session.available, true);
      queryClient.setQueryData(queryKeys.session.me, result.user);
      // Progress is derived from the user; it changed, so force a fresh fetch.
      void queryClient.invalidateQueries({ queryKey: queryKeys.session.progress });
    },
  });

  const [error, setError] = useState<string | null>(null);

  // `mutateAsync` rejects on 4xx/5xx; the try/catch turns that into a
  // normalized message. `onSuccess` has already primed the shared session cache
  // by the time the promise resolves.
  const signup = useCallback(
    async (form: SignupForm): Promise<SignupResult | null> => {
      setError(null);
      try {
        return await mutation.mutateAsync(form);
      } catch (e) {
        setError(describeSignupError(e));
        return null;
      }
    },
    [mutation],
  );

  return {
    signup,
    isPending: mutation.isPending,
    isError: error !== null,
    error,
  };
}
