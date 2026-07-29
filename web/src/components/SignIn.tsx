import { useState } from 'react';

import { ApiError, forgotPassword, resetPassword } from '../api';

type Mode = 'signIn' | 'signUp' | 'forgotPassword' | 'resetPassword';

/**
 * Sign in, create an account, or reset a forgotten password.
 *
 * The forgot-password flow is two steps:
 *   1. Enter email → the server writes a six-digit code to its own log
 *   2. Enter that code + a new password → the server resets it
 *
 * There is no mail service on Stage A, so the code is read off the API log by
 * whoever is running it. `api/src/auth/auth.service.ts` documents that trade.
 */
export function SignIn({
  onSignIn,
  onSignUp,
}: {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (
    email: string,
    password: string,
    displayName: string,
    dateOfBirth: string,
  ) => Promise<void>;
}) {
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (mode === 'forgotPassword') {
      if (!email.includes('@')) return setError('That doesn’t look like an email address.');
      setBusy(true);
      try {
        const result = await forgotPassword(email.trim());
        setSuccess(result.message);
        setMode('resetPassword');
      } catch (caught) {
        setError(messageFor(caught, mode));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (mode === 'resetPassword') {
      if (!email.includes('@')) return setError('Enter the email you requested the reset for.');
      if (resetCode.trim().length === 0) return setError('Enter the six-digit code from the API server log.');
      if (newPassword.length < 8) return setError('New password must be at least 8 characters.');
      setBusy(true);
      try {
        const result = await resetPassword(email.trim(), resetCode.trim(), newPassword);
        setSuccess(result.message);
        setMode('signIn');
        setPassword('');
        setResetCode('');
        setNewPassword('');
      } catch (caught) {
        setError(messageFor(caught, mode));
      } finally {
        setBusy(false);
      }
      return;
    }

    // Normal sign in / sign up
    if (!email.includes('@')) return setError('That doesn’t look like an email address.');
    if (password.length < 8) return setError('Passwords are at least 8 characters.');
    if (mode === 'signUp' && displayName.trim().length === 0) {
      return setError('Pick a name to be called by.');
    }
    if (mode === 'signUp') {
      if (!dateOfBirth) return setError('Enter your date of birth.');
      if (ageFrom(dateOfBirth) < MIN_AGE) {
        return setError(`You need to be at least ${MIN_AGE} to create an account.`);
      }
    }

    setBusy(true);
    try {
      if (mode === 'signIn') await onSignIn(email.trim(), password);
      else await onSignUp(email.trim(), password, displayName.trim(), dateOfBirth);
    } catch (caught) {
      setError(messageFor(caught, mode));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="glass panel signin" onSubmit={submit}>
      <div className="signin-head">
        <h3>
          {mode === 'signIn' && 'Sign in to start learning'}
          {mode === 'signUp' && 'Create an account'}
          {mode === 'forgotPassword' && 'Forgot your password?'}
          {mode === 'resetPassword' && 'Reset your password'}
        </h3>
        <p>
          {mode === 'signIn' && 'Your progress is the same here as in the app.'}
          {mode === 'signUp' && 'One account, shared between this site and the Android app.'}
          {mode === 'forgotPassword' && 'Enter your email and we’ll generate a reset code.'}
          {mode === 'resetPassword' && 'Enter the six-digit code and your new password.'}
        </p>
      </div>

      {mode === 'signUp' ? (
        <label className="field">
          <span>Name</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="nickname"
            maxLength={60}
            required
          />
        </label>
      ) : null}

      {mode === 'signUp' ? (
        <label className="field">
          <span>Date of birth</span>
          <input
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            autoComplete="bday"
            max={TODAY}
            required
          />
          <small className="field-hint">
            Used once, to check you are old enough for the social features. Never shown to
            anyone.
          </small>
        </label>
      ) : null}

      {/* Email — shown in all modes */}
      <label className="field">
        <span>Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          maxLength={254}
          required
        />
      </label>

      {/* Password — only in sign-in and sign-up modes */}
      {(mode === 'signIn' || mode === 'signUp') && (
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
            minLength={8}
            maxLength={128}
            required
          />
        </label>
      )}

      {/* Forgot password link — only on sign-in */}
      {mode === 'signIn' && (
        <button
          className="link-button forgot-link"
          type="button"
          onClick={() => { setMode('forgotPassword'); setError(null); setSuccess(null); }}
        >
          Forgot password?
        </button>
      )}

      {/* Reset code + new password — only in resetPassword mode */}
      {mode === 'resetPassword' && (
        <>
          <label className="field">
            <span>Reset code</span>
            <input
              type="text"
              value={resetCode}
              onChange={(e) => setResetCode(e.target.value)}
              placeholder="6-digit code"
              autoComplete="one-time-code"
              maxLength={6}
              required
            />
          </label>
          <label className="field">
            <span>New password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
            />
          </label>
        </>
      )}

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="form-success" role="status">
          {success}
        </p>
      ) : null}

      <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%' }}>
        {busy ? 'Working…'
          : mode === 'signIn' ? 'Sign in'
          : mode === 'signUp' ? 'Create account'
          : mode === 'forgotPassword' ? 'Send reset code'
          : 'Reset password'}
      </button>

      <div className="signin-links">
        {(mode === 'signIn' || mode === 'signUp') && (
          <button
            className="link-button"
            type="button"
            onClick={() => { setMode(mode === 'signIn' ? 'signUp' : 'signIn'); setError(null); setSuccess(null); }}
          >
            {mode === 'signIn' ? 'No account yet? Create one' : 'Already have an account? Sign in'}
          </button>
        )}

        {(mode === 'forgotPassword' || mode === 'resetPassword') && (
          <button
            className="link-button"
            type="button"
            onClick={() => { setMode('signIn'); setError(null); setSuccess(null); }}
          >
            ← Back to sign in
          </button>
        )}
      </div>
    </form>
  );
}

function messageFor(error: unknown, mode: Mode): string {
  if (!(error instanceof ApiError)) return 'That didn’t work. Try again.';

  if (error.status === 0) return error.message;
  if (error.status === 429) {
    return 'Too many attempts. Wait about a minute, then try again.';
  }
  if (error.status === 401) {
    if (mode === 'resetPassword') return 'Invalid or expired reset code.';
    return 'That email and password don’t match an account.';
  }
  if (error.status === 409 && mode === 'signUp') {
    return 'An account already exists for that email. Try signing in.';
  }
  return error.message;
}

/** Minimum age to hold an account. Mirrors MIN_AGE_TO_REGISTER on the server. */
const MIN_AGE = 13;

/** Today as 'YYYY-MM-DD', so the picker cannot offer a future date. */
const TODAY = new Date().toISOString().slice(0, 10);

function ageFrom(iso: string): number {
  const born = new Date(iso);
  if (Number.isNaN(born.getTime())) return -1;

  const now = new Date();
  let years = now.getFullYear() - born.getFullYear();
  const months = now.getMonth() - born.getMonth();
  if (months < 0 || (months === 0 && now.getDate() < born.getDate())) years -= 1;
  return years;
}
