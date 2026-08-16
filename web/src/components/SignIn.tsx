import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import { ApiError, forgotPassword, resetPassword } from '../api';

type Mode = 'signIn' | 'forgotPassword' | 'resetPassword';

/** Compact landing-page sign in. Account creation lives at `/signup`. */
export function SignIn({
  onSignIn,
}: {
  onSignIn: (email: string, password: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    setError(null);
    setSuccess(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }

    if (mode === 'forgotPassword') {
      setBusy(true);
      try {
        const result = await forgotPassword(email.trim());
        setMode('resetPassword');
        setSuccess(result.message);
      } catch (caught) {
        setError(messageFor(caught, mode));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (mode === 'resetPassword') {
      if (!/^\d{6}$/.test(resetCode.trim())) {
        setError('Enter the six-digit code from your email.');
        return;
      }
      if (newPassword.length < 8) {
        setError('New password must be at least 8 characters.');
        return;
      }

      setBusy(true);
      try {
        const result = await resetPassword(email.trim(), resetCode.trim(), newPassword);
        setMode('signIn');
        setPassword('');
        setResetCode('');
        setNewPassword('');
        setSuccess(result.message);
      } catch (caught) {
        setError(messageFor(caught, mode));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!password) {
      setError('Enter your password.');
      return;
    }

    setBusy(true);
    try {
      await onSignIn(email.trim(), password);
    } catch (caught) {
      setError(messageFor(caught, mode));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="glass panel signin" onSubmit={submit} noValidate>
      <div className="signin-head">
        <h3>
          {mode === 'signIn' && 'Continue learning'}
          {mode === 'forgotPassword' && 'Reset your password'}
          {mode === 'resetPassword' && 'Check your email'}
        </h3>
        <p>
          {mode === 'signIn' && 'Your lessons, reviews, XP, and streak are waiting.'}
          {mode === 'forgotPassword' && 'Enter your email and we will send a six-digit reset code.'}
          {mode === 'resetPassword' && 'Enter the code from your email and choose a new password.'}
        </p>
      </div>

      <label className="field">
        <span>Email</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          maxLength={254}
          disabled={busy}
          required
        />
      </label>

      {mode === 'signIn' ? (
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            maxLength={128}
            disabled={busy}
            required
          />
        </label>
      ) : null}

      {mode === 'signIn' ? (
        <button className="link-button forgot-link" type="button" onClick={() => changeMode('forgotPassword')}>
          Forgot password?
        </button>
      ) : null}

      {mode === 'resetPassword' ? (
        <>
          <label className="field">
            <span>Reset code</span>
            <input
              type="text"
              inputMode="numeric"
              value={resetCode}
              onChange={(event) => setResetCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit code"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              disabled={busy}
              required
            />
          </label>
          <label className="field">
            <span>New password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              disabled={busy}
              required
            />
          </label>
        </>
      ) : null}

      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {success ? <p className="form-success" role="status">{success}</p> : null}

      <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%' }}>
        {busy ? 'Working…' : mode === 'signIn' ? 'Sign in' : mode === 'forgotPassword' ? 'Send reset code' : 'Set new password'}
      </button>

      <div className="signin-links">
        {mode === 'signIn' ? (
          <p>
            New here? <Link to="/signup">Create your learning profile</Link>
          </p>
        ) : (
          <button className="link-button" type="button" onClick={() => changeMode('signIn')}>
            ← Back to sign in
          </button>
        )}
      </div>
    </form>
  );
}

function messageFor(error: unknown, mode: Mode): string {
  if (!(error instanceof ApiError)) return 'That did not work. Try again.';
  if (error.status === 0) return error.message;
  if (error.status === 429) return 'Too many attempts. Wait about a minute, then try again.';
  if (error.status === 401) {
    return mode === 'resetPassword'
      ? 'That reset code is invalid or expired.'
      : 'That email and password do not match an account.';
  }
  return error.message;
}
