import type { FormEvent } from 'react';
import '../../styles/verify-email.css';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { Loader2, Mail } from 'lucide-react';

import { useSession } from '../../useSession';
import { verifyEmail, resendVerification } from '../../api';
import { queryKeys } from '../../queryKeys';

type VerifyEmailPageProps = {
  initialDeliveryStatus?: 'queued' | 'unavailable';
};

export function VerifyEmailPage({ initialDeliveryStatus }: VerifyEmailPageProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session, signOut } = useSession();
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    initialDeliveryStatus === 'unavailable'
      ? 'Your account is ready, but the verification email could not be queued. Use resend to try again.'
      : null,
  );
  const [success, setSuccess] = useState<string | null>(
    initialDeliveryStatus === 'queued' ? 'Your verification email has been queued.' : null,
  );

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    if (token.length !== 6) return;
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const result = await verifyEmail(token);
      setSuccess(result.message);
      await queryClient.invalidateQueries({ queryKey: queryKeys.session.me });
      setTimeout(() => navigate({ to: '/onboarding', replace: true }), 1000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const result = await resendVerification();
      setSuccess(result.message);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to resend.');
    } finally {
      setBusy(false);
    }
  }

  if (session.state !== 'signedIn') {
    return (
      <div className="vem-page">
        <div className="vem-card">
          <VerifyEmailIcon />
          <h1 className="vem-title">Verify Your Email</h1>
          <p className="vem-subtitle">
            {session.state === 'loading' ? 'Loading…' : 'Sign in to verify your email address.'}
          </p>
          {session.state === 'signedOut' ? <Link className="vem-btn vem-btn-primary" to="/signin">Sign in</Link> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="vem-page">
      <div className="vem-card">
        <VerifyEmailIcon />

        <h1 className="vem-title">Verify Your Email</h1>

        {session.user.emailVerified ? (
          <>
            <p className="vem-subtitle vem-success">Your email is already verified.</p>
            <button
              className="vem-btn vem-btn-primary"
              onClick={() => {
                if (session.user.onboardingState?.onboardingComplete) {
                  navigate({ to: '/', replace: true });
                } else {
                  navigate({ to: '/onboarding', replace: true });
                }
              }}
            >
              {session.user.onboardingState?.onboardingComplete ? 'Go to dashboard' : 'Continue setup'}
            </button>
          </>
        ) : (
          <>
            <p className="vem-subtitle">
              Enter the six-digit code emailed to {session.user.email} to verify your address.
            </p>

            <form className="vem-form" onSubmit={handleVerify}>
              <label className="vem-label" htmlFor="vem-token">
                Verification code
              </label>
              <input
                id="vem-token"
                className="vem-input"
                type="text"
                inputMode="numeric"
                value={token}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
              />

              {error && <p className="vem-error" role="alert">{error}</p>}
              {success && <p className="vem-msg vem-msg-success" role="status">{success}</p>}

              <button
                type="submit"
                className="vem-btn vem-btn-primary"
                disabled={token.length !== 6 || busy}
              >
                {busy ? (
                  <><Loader2 className="vem-spinner" size={18} strokeWidth={2} aria-hidden="true" /> Verifying…</>
                ) : (
                  'Verify email'
                )}
              </button>
            </form>

            <p className="vem-footer">
              Didn&apos;t get a code?{' '}
              <button
                className="vem-link"
                type="button"
                onClick={handleResend}
                disabled={busy}
              >
                Resend verification
              </button>
              {' · '}
              <button className="vem-link" type="button" onClick={signOut} disabled={busy}>
                Sign out
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function VerifyEmailIcon() {
  return (
    <div className="vem-icon-wrap" aria-hidden="true">
      <Mail size={28} strokeWidth={1.75} />
    </div>
  );
}
