import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { Link, useNavigate } from '@tanstack/react-router';

import { forgotPassword, resetPassword } from '../../api';
import { useSession } from '../../useSession';
import { playSigninEntrance, playSuccessTransition } from '../../animations/signin.motion';
import { cn } from '../../lib';
import { PASSWORD_MIN_LENGTH } from '../../validation/signup.schema';

type Mode = 'signIn' | 'forgotPassword' | 'resetPassword';

/** The canonical sign-in and account-recovery form. Signup has its own route. */
export function SigninForm() {
  const navigate = useNavigate();
  const cardRef = useRef<HTMLDivElement>(null);
  const { signIn } = useSession();

  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    playSigninEntrance(cardRef.current);
  }, []);

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    setError(null);
    setSuccess(null);
  }

  async function handleSubmit(event: FormEvent) {
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
      } catch (caught: unknown) {
        setError(caught instanceof Error ? caught.message : 'Something went wrong.');
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
      if (newPassword.length < PASSWORD_MIN_LENGTH) {
        setError(`Your new password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
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
      } catch (caught: unknown) {
        setError(caught instanceof Error ? caught.message : 'Something went wrong.');
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
      await signIn(email.trim(), password);
      playSuccessTransition(cardRef.current, () => navigate({ to: '/', replace: true }));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'That email and password do not match.');
    } finally {
      setBusy(false);
    }
  }

  const activePassword = mode === 'resetPassword' ? newPassword : password;
  const setActivePassword = mode === 'resetPassword' ? setNewPassword : setPassword;

  return (
    <div className="signin-form-side">
      <div className="signin-card" ref={cardRef}>
        <Link to="/" className="signin-brand" aria-label="GENKŌ home" data-signin-reveal>
          <span className="signin-logo-mark" aria-hidden="true" />
          <span className="signin-logo-text">GENKŌ</span>
        </Link>

        <h1 className="signin-title" data-signin-reveal>
          {mode === 'signIn' && 'Welcome back'}
          {mode === 'forgotPassword' && 'Reset your password'}
          {mode === 'resetPassword' && 'Check your email'}
        </h1>
        <p className="signin-subtitle" data-signin-reveal>
          {mode === 'signIn' && 'Pick up your Japanese journey where you left off.'}
          {mode === 'forgotPassword' && 'Enter your account email and we will send a six-digit reset code.'}
          {mode === 'resetPassword' && 'Enter the six-digit code and choose a new password.'}
        </p>

        <form className="signin-form" onSubmit={handleSubmit} noValidate data-signin-reveal aria-busy={busy}>
          <div className="signin-field">
            <label className="signin-field-label" htmlFor="signin-email">
              Email address
              <span className="signin-required" aria-hidden="true" />
            </label>
            <div className="signin-input-wrap">
              <Mail className="signin-input-icon" aria-hidden="true" size={18} strokeWidth={1.75} />
              <input
                id="signin-email"
                name="email"
                className="signin-input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                maxLength={254}
                disabled={busy}
                required
              />
            </div>
          </div>

          {mode === 'resetPassword' ? (
            <div className="signin-field">
              <label className="signin-field-label" htmlFor="signin-code">Reset code</label>
              <div className="signin-input-wrap">
                <input
                  id="signin-code"
                  name="code"
                  className="signin-input signin-input--plain"
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
              </div>
            </div>
          ) : null}

          {mode !== 'forgotPassword' ? (
            <div className="signin-field">
              <label className="signin-field-label" htmlFor="signin-password">
                {mode === 'resetPassword' ? 'New password' : 'Password'}
                <span className="signin-required" aria-hidden="true" />
              </label>
              <div className="signin-input-wrap">
                <Lock className="signin-input-icon" aria-hidden="true" size={18} strokeWidth={1.75} />
                <input
                  id="signin-password"
                  name="password"
                  className="signin-input"
                  type={showPassword ? 'text' : 'password'}
                  value={activePassword}
                  onChange={(event) => setActivePassword(event.target.value)}
                  placeholder={mode === 'resetPassword' ? `At least ${PASSWORD_MIN_LENGTH} characters` : 'Your password'}
                  autoComplete={mode === 'resetPassword' ? 'new-password' : 'current-password'}
                  minLength={mode === 'resetPassword' ? PASSWORD_MIN_LENGTH : undefined}
                  maxLength={128}
                  disabled={busy}
                  required
                />
                <button
                  type="button"
                  className="signin-input-toggle"
                  onClick={() => setShowPassword((previous) => !previous)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  disabled={busy}
                >
                  {showPassword ? <EyeOff size={18} strokeWidth={1.75} aria-hidden="true" /> : <Eye size={18} strokeWidth={1.75} aria-hidden="true" />}
                </button>
              </div>
            </div>
          ) : null}

          {mode === 'signIn' ? (
            <div className="signin-options">
              <button type="button" className="signin-forgot" onClick={() => changeMode('forgotPassword')}>
                Forgot password?
              </button>
            </div>
          ) : null}

          {error ? <p className="signin-server-error" role="alert">{error}</p> : null}
          {success ? <p className="signin-server-success" role="status">{success}</p> : null}

          <button type="submit" className={cn('signin-submit', busy && 'signin-submit--pending')} disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="signin-spinner" aria-hidden="true" size={18} strokeWidth={2} />
                <span>
                  {mode === 'signIn' && 'Signing in…'}
                  {mode === 'forgotPassword' && 'Sending code…'}
                  {mode === 'resetPassword' && 'Updating password…'}
                </span>
              </>
            ) : mode === 'signIn' ? 'Sign in' : mode === 'forgotPassword' ? 'Send reset code' : 'Set new password'}
          </button>

          {mode !== 'signIn' ? (
            <button type="button" className="signin-back" onClick={() => changeMode('signIn')}>
              ← Back to sign in
            </button>
          ) : null}
        </form>

        {mode === 'signIn' ? (
          <p className="signin-footer" data-signin-reveal>
            New to Japanese? <Link to="/signup" className="signin-link">Create your learning profile</Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
