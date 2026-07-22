import { useState } from 'react';

import { ApiError } from '../api';

type Mode = 'signIn' | 'signUp';

/**
 * Sign in or create an account.
 *
 * The API answers **401 "Invalid credentials" for both an unknown email and a
 * wrong password**, deliberately, and burns a dummy argon2 verify when no user
 * exists so the timing matches. So the copy here must not claim which field was
 * wrong — the server does not know, and guessing would undo the anti-enumeration
 * on purpose.
 */
export function SignIn({
  onSignIn,
  onSignUp,
}: {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string, displayName: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    // Mirrors the server's own rules, so an obvious mistake does not cost a
    // round trip — and, on sign-up, does not burn one of the 10-per-minute
    // attempts the auth routes allow.
    if (!email.includes('@')) return setError('That doesn’t look like an email address.');
    if (password.length < 8) return setError('Passwords are at least 8 characters.');
    if (mode === 'signUp' && displayName.trim().length === 0) {
      return setError('Pick a name to be called by.');
    }

    setBusy(true);
    try {
      if (mode === 'signIn') await onSignIn(email.trim(), password);
      else await onSignUp(email.trim(), password, displayName.trim());
    } catch (caught) {
      setError(messageFor(caught, mode));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="glass panel signin" onSubmit={submit}>
      <div className="signin-head">
        <h3>{mode === 'signIn' ? 'Sign in to start learning' : 'Create an account'}</h3>
        <p>
          {mode === 'signIn'
            ? 'Your progress is the same here as in the app.'
            : 'One account, shared between this site and the Android app.'}
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

      <label className="field">
        <span>Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          // Tells a password manager to offer a new one rather than autofill
          // the old — the single most useful attribute on this form.
          autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
          minLength={8}
          maxLength={128}
          required
        />
      </label>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <button className="button" type="submit" disabled={busy}>
        {busy ? 'Working…' : mode === 'signIn' ? 'Sign in' : 'Create account'}
      </button>

      <button
        className="link-button"
        type="button"
        onClick={() => {
          setMode(mode === 'signIn' ? 'signUp' : 'signIn');
          setError(null);
        }}
      >
        {mode === 'signIn' ? 'No account yet? Create one' : 'Already have an account? Sign in'}
      </button>
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
    // Deliberately vague — see the note above.
    return 'That email and password don’t match an account.';
  }
  if (error.status === 409 && mode === 'signUp') {
    return 'An account already exists for that email. Try signing in.';
  }
  return error.message;
}
