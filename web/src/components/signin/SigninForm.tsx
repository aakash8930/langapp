import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Lock, Mail, Loader2 } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';

import { API_BASE, forgotPassword, resetPassword } from '../../api';
import { useSession } from '../../useSession';
import { playSigninEntrance, playSuccessTransition } from '../../animations/signin.motion';
import { cn } from '../../lib';

function GoogleLogo() {
  return (
    <svg className="signin-oauth-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.75 3.28-8.09z" />
      <path fill="#34A853" d="M12 24c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.34v2.85C4.15 21.05 7.78 24 12 24z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.34C1.48 8.66 1 10.55 1 12.5s.48 3.84 1.34 5.43l3.5-2.84z" />
      <path fill="#EA4335" d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.09 14.97 0 12 0 7.78 0 4.15 2.95 2.34 6.57l3.5 2.84c.87-2.6 3.3-4.66 6.16-4.66z" />
    </svg>
  );
}

function GitHubLogo() {
  return (
    <svg className="signin-oauth-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.73.5.5 5.73.5 12.5c0 5.08 3.29 9.38 7.86 10.92.57.11.79-.25.79-.55 0-.28-.01-1.16-.02-2.21-3.34.72-4.03-1.61-4.03-1.61-.55-1.38-1.34-1.75-1.34-1.75-1.09-.74.08-.73.08-.73 1.21.08 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .11-.77.42-1.3.76-1.6-2.66-.3-5.47-1.33-5.47-5.93 0-1.25.47-2.38 1.24-3.02-.14-.3-.54-1.52.11-2.75 0 0 1-.32 3.29 1.23.95-.26 1.97-.39 2.98-.39 1.02 0 2.04.14 2.99.39 2.28-1.55 3.29-1.23 3.29-1.23.64 1.43.24 2.46.12 2.75.78.84 1.24 1.91 1.24 3.02 0 4.61-3.44 5.62-5.77 5.91.43.36.82 1.1.82 2.22 0 1.66-.02 2.9-.02 3.29 0 .32.21.69.83.57C20.57 22.58 24 18.08 24 12.5 24 5.73 18.73.5 12 .5z" />
    </svg>
  );
}

function AppleLogo() {
  return (
    <svg className="signin-oauth-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

const MIN_AGE = 13;
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

type Mode = 'signIn' | 'signUp' | 'forgotPassword' | 'resetPassword';

export function SigninForm() {
  const navigate = useNavigate();
  const cardRef = useRef<HTMLDivElement>(null);
  const { signIn, signUp } = useSession();

  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    playSigninEntrance(cardRef.current);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Forgot password flow
    if (mode === 'forgotPassword') {
      if (!email.includes('@')) return setError('That doesn\'t look like an email address.');
      setBusy(true);
      try {
        const result = await forgotPassword(email.trim());
        setSuccess(result.message);
        setMode('resetPassword');
      } catch (caught: unknown) {
        setError(caught instanceof Error ? caught.message : 'Something went wrong.');
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
      } catch (caught: unknown) {
        setError(caught instanceof Error ? caught.message : 'Something went wrong.');
      } finally {
        setBusy(false);
      }
      return;
    }

    // Sign in / up
    if (!email.includes('@')) return setError('That doesn\'t look like an email address.');
    if (password.length < 8) return setError('Passwords are at least 8 characters.');

    if (mode === 'signUp') {
      if (displayName.trim().length === 0) return setError('Pick a name to be called by.');
      if (!dateOfBirth) return setError('Enter your date of birth.');
      if (ageFrom(dateOfBirth) < MIN_AGE) {
        return setError(`You need to be at least ${MIN_AGE} to create an account.`);
      }
    }

    setBusy(true);
    try {
      if (mode === 'signIn') {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password, displayName.trim(), dateOfBirth);
      }
      playSuccessTransition(cardRef.current, () => navigate({ to: '/' }));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'That didn\'t work. Try again.');
    } finally {
      setBusy(false);
    }
  }

  function redirect(url: string) {
    window.location.href = url;
  }

  return (
    <div className="signin-form-side">
      <div className="signin-card" ref={cardRef}>
        {/* Brand */}
        <div className="signin-brand" data-signin-reveal>
          <span className="signin-logo-mark" aria-hidden="true" />
          <span className="signin-logo-text">GENKŌ</span>
        </div>

        <h1 className="signin-title" data-signin-reveal>
          {mode === 'signIn' && 'Welcome Back'}
          {mode === 'signUp' && 'Create your account'}
          {mode === 'forgotPassword' && 'Forgot password?'}
          {mode === 'resetPassword' && 'Reset password'}
        </h1>
        <p className="signin-subtitle" data-signin-reveal>
          {mode === 'signIn' && 'Continue your language journey.'}
          {mode === 'signUp' && 'Start your language journey today.'}
          {mode === 'forgotPassword' && 'Enter your email and we\'ll send a reset code.'}
          {mode === 'resetPassword' && 'Enter the code and your new password.'}
        </p>

        <form className="signin-form" onSubmit={handleSubmit} noValidate data-signin-reveal>
          {/* Name — sign up only */}
          {mode === 'signUp' && (
            <div className="signin-field">
              <label className="signin-field-label" htmlFor="signin-name">
                Full Name
                <span className="signin-required" aria-hidden="true" />
              </label>
              <div className="signin-input-wrap">
                <input
                  id="signin-name"
                  name="name"
                  className="signin-input"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                  maxLength={60}
                  required
                />
              </div>
            </div>
          )}

          {/* Email */}
          <div className="signin-field">
            <label className="signin-field-label" htmlFor="signin-email">
              Email
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
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                maxLength={254}
                required
              />
            </div>
          </div>

          {/* Password — sign in / up */}
          {(mode === 'signIn' || mode === 'signUp') && (
            <div className="signin-field">
              <label className="signin-field-label" htmlFor="signin-password">
                Password
                <span className="signin-required" aria-hidden="true" />
              </label>
              <div className="signin-input-wrap">
                <Lock className="signin-input-icon" aria-hidden="true" size={18} strokeWidth={1.75} />
                <input
                  id="signin-password"
                  name="password"
                  className="signin-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                  minLength={8}
                  maxLength={128}
                  required
                />
                <button
                  type="button"
                  className="signin-input-toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <EyeOff size={18} strokeWidth={1.75} aria-hidden="true" />
                  ) : (
                    <Eye size={18} strokeWidth={1.75} aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Date of birth — sign up only */}
          {mode === 'signUp' && (
            <div className="signin-field">
              <label className="signin-field-label" htmlFor="signin-dob">
                Date of Birth
                <span className="signin-required" aria-hidden="true" />
              </label>
              <div className="signin-input-wrap">
                <input
                  id="signin-dob"
                  name="dob"
                  className="signin-input"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  autoComplete="bday"
                  max={TODAY}
                  required
                />
              </div>
              <span className="signin-field-hint">
                Used once, to check you are old enough for social features. Never shown.
              </span>
            </div>
          )}

          {/* Reset password — code + new password */}
          {mode === 'resetPassword' && (
            <>
              <div className="signin-field">
                <label className="signin-field-label" htmlFor="signin-code">
                  Reset Code
                </label>
                <div className="signin-input-wrap">
                  <input
                    id="signin-code"
                    className="signin-input"
                    type="text"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    placeholder="6-digit code"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                  />
                </div>
              </div>
              <div className="signin-field">
                <label className="signin-field-label" htmlFor="signin-new-pw">
                  New Password
                </label>
                <div className="signin-input-wrap">
                  <Lock className="signin-input-icon" aria-hidden="true" size={18} strokeWidth={1.75} />
                  <input
                    id="signin-new-pw"
                    className="signin-input"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={128}
                    required
                  />
                </div>
              </div>
            </>
          )}

          {/* Remember me + forgot password — sign in only */}
          {mode === 'signIn' && (
            <div className="signin-options">
              <label className="signin-remember">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                Remember me
              </label>
              <button
                type="button"
                className="signin-forgot"
                onClick={() => { setMode('forgotPassword'); setError(null); setSuccess(null); }}
              >
                Forgot password?
              </button>
            </div>
          )}

          {/* Error / success */}
          {error && <p className="signin-server-error" role="alert">{error}</p>}
          {success && <p className="signin-server-success" role="status">{success}</p>}

          {/* Submit */}
          <button
            type="submit"
            className={cn('signin-submit', busy && 'signin-submit--pending')}
            disabled={busy}
          >
            {busy ? (
              <>
                <Loader2 className="signin-spinner" aria-hidden="true" size={18} strokeWidth={2} />
                <span>
                  {mode === 'signIn' && 'Signing in…'}
                  {mode === 'signUp' && 'Creating account…'}
                  {mode === 'forgotPassword' && 'Sending reset code…'}
                  {mode === 'resetPassword' && 'Resetting password…'}
                </span>
              </>
            ) : (
              <>
                {mode === 'signIn' && 'Sign In'}
                {mode === 'signUp' && 'Create Account'}
                {mode === 'forgotPassword' && 'Send Reset Code'}
                {mode === 'resetPassword' && 'Reset Password'}
              </>
            )}
          </button>

          {/* Mode switch — only on sign in / up */}
          {(mode === 'signIn' || mode === 'signUp') && (
            <button
              type="button"
              className="signin-forgot"
              style={{ textAlign: 'center', background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={() => { setMode(mode === 'signIn' ? 'signUp' : 'signIn'); setError(null); setSuccess(null); }}
            >
              {mode === 'signIn' ? 'No account yet? Create one' : 'Already have an account? Sign in'}
            </button>
          )}

          {/* Back to sign in — forgot / reset modes */}
          {(mode === 'forgotPassword' || mode === 'resetPassword') && (
            <button
              type="button"
              className="signin-forgot"
              style={{ textAlign: 'center', background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={() => { setMode('signIn'); setError(null); setSuccess(null); }}
            >
              ← Back to sign in
            </button>
          )}
        </form>

        {/* Divider + OAuth */}
        {(mode === 'signIn' || mode === 'signUp') && (
          <>
            <div className="signin-divider" data-signin-reveal>
              <span>or continue with</span>
            </div>
            <div className="signin-oauth" data-signin-reveal>
              <button
                type="button"
                className="signin-oauth-btn"
                onClick={() => redirect(`${API_BASE}/auth/google`)}
              >
                <GoogleLogo />
                <span>Continue with Google</span>
              </button>
              <button
                type="button"
                className="signin-oauth-btn signin-oauth-btn--github"
                onClick={() => redirect(`${API_BASE}/auth/github`)}
              >
                <GitHubLogo />
                <span>Continue with GitHub</span>
              </button>
              <button
                type="button"
                className="signin-oauth-btn signin-oauth-btn--apple"
                onClick={() => redirect(`${API_BASE}/auth/apple`)}
              >
                <AppleLogo />
                <span>Continue with Apple</span>
              </button>
            </div>
          </>
        )}

        {/* Footer link to sign up */}
        {mode === 'signIn' && (
          <p className="signin-footer" data-signin-reveal>
            Don&apos;t have an account?{' '}
            <button
              type="button"
              className="signin-link"
              style={{ fontFamily: 'inherit', fontSize: 'inherit', background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={() => { setMode('signUp'); setError(null); setSuccess(null); }}
            >
              Create Account
            </button>
          </p>
        )}
        {mode === 'signUp' && (
          <p className="signin-footer" data-signin-reveal>
            Already have an account?{' '}
            <button
              type="button"
              className="signin-link"
              style={{ fontFamily: 'inherit', fontSize: 'inherit', background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={() => { setMode('signIn'); setError(null); setSuccess(null); }}
            >
              Sign In
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
