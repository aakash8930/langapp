import { ApiError, OfflineError } from '@/api/client';

/**
 * Field rules mirror the server's DTOs (`api/src/auth/dto/*.dto.ts`). Keeping
 * them in step matters: a rule that is looser here shows the user a raw
 * class-validator string, and one that is stricter locks them out of an
 * account the server would have accepted.
 */

export const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
const EMAIL_MAX_LENGTH = 254;
const DISPLAY_NAME_MAX_LENGTH = 60;

// Deliberately loose. The server owns the real verdict; this only catches the
// obvious typo before spending a round trip on it.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value: string): string | undefined {
  const email = value.trim();
  if (!email) return 'Enter your email address.';
  if (email.length > EMAIL_MAX_LENGTH) return 'That email address is too long.';
  if (!EMAIL_PATTERN.test(email)) {
    return 'That doesn’t look like an email address. Check for a missing @ or a typo.';
  }
  return undefined;
}

/** Login only checks presence — the server decides, and the account may predate any rule. */
export function validateLoginPassword(value: string): string | undefined {
  if (!value) return 'Enter your password.';
  return undefined;
}

export function validateNewPassword(value: string): string | undefined {
  if (!value) return 'Choose a password.';
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters. That one has ${value.length}.`;
  }
  if (value.length > PASSWORD_MAX_LENGTH) {
    return `Use at most ${PASSWORD_MAX_LENGTH} characters.`;
  }
  return undefined;
}

export function validateDisplayName(value: string): string | undefined {
  const name = value.trim();
  if (!name) return 'Enter a display name.';
  if (name.length > DISPLAY_NAME_MAX_LENGTH) {
    return `Use at most ${DISPLAY_NAME_MAX_LENGTH} characters.`;
  }
  return undefined;
}

/**
 * Turns a thrown request error into a sentence that says what happened and what
 * to do next.
 */
export function authErrorMessage(error: unknown, action: 'login' | 'register'): string {
  if (error instanceof OfflineError) return error.message;

  if (error instanceof ApiError) {
    switch (error.status) {
      case 401:
        // The server answers unknown-email and wrong-password identically, on
        // purpose, so that a stranger cannot use this form to discover which
        // addresses are registered. The copy therefore names the pair, not the
        // field — claiming "your password is wrong" would be a guess, and it
        // would be wrong in exactly the case where it matters.
        return 'That email and password don’t match. Check both and try again.';
      case 409:
        return 'An account already uses this email. Sign in instead.';
      case 429:
        return `Too many ${action === 'login' ? 'sign-in' : 'sign-up'} attempts. Wait a minute, then try again.`;
      case 400:
        // The field checks above run first, so a 400 means the server was
        // stricter than we were. The reachable case is email: class-validator's
        // IsEmail rejects addresses our deliberately-loose pattern allows
        // (`foo@bar..com`). Answer that in our own words — the raw string is
        // "email must be an email", which is not copy we would ever ship.
        if (/email/i.test(error.message)) {
          return 'That doesn’t look like an email address. Check for a missing @ or a typo.';
        }
        return error.message;
      default:
        return error.message;
    }
  }

  if (error instanceof Error && error.message) return error.message;
  return 'That didn’t go through. Try again.';
}
