/**
 * Signup service boundary.
 *
 * This is a thin layer over the generated API client in `api.ts` — it owns the
 * mapping from the signup form's shape to `RegisterDto`'s shape (trimming,
 * injecting the browser timezone the server needs to place "today"), and it is
 * the single place that translates an `ApiError` into the user-facing string
 * the form renders. Keeping the translation out of the component lets the
 * component stay declarative: it just reads `error: string | null`.
 */
import { ApiError, register, type AuthResponse } from '../api';
import { logError } from '../debug';

import type { SignupForm } from '../validation/signup.schema';

export type SignupResult = AuthResponse;

/**
 * Maps the validated form to the register endpoint and returns the auth
 * response (user + tokens) verbatim. Token storage is left to the caller — see
 * `useSignup` — so this stays a pure data function: testable, React-free, and
 * trivially swappable if the endpoint shape ever changes.
 */
export async function registerAccount(form: SignupForm): Promise<SignupResult> {
  return register({
    email: form.email.trim(),
    password: form.password,
    displayName: form.fullName.trim(),
    dateOfBirth: form.dateOfBirth,
    // The server needs a zone to decide what "today" means for the streak;
    // the browser is the only thing that knows it.
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
}

/**
 * Translates a failed register call into the message the form should show.
 *
 * Status codes are the contract the backend chose to surface (the `@HttpCode`
 * policy in `auth.controller.ts`), so the mapping is by number, not by parsing
 * the body — a body change never silently swaps one message for another.
 */
export function describeSignupError(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 400:
        return error.message || 'The details you entered are invalid. Check them and try again.';
      case 409:
        return 'An account already exists for that email. Sign in instead.';
      case 429:
        return 'Too many attempts. Wait a moment, then try again.';
      case 0:
        return "Can't reach the server. The API runs on a laptop — check that it's awake.";
      default:
        return error.message || 'Something went wrong. Please try again.';
    }
  }

  logError('auth', 'signup failed with a non-ApiError', error);

  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}
