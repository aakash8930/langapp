import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2, Shield, Lock, Key, Monitor, AlertTriangle, Trash2 } from 'lucide-react';
import QRCode from 'qrcode';

import {
  changePassword,
  get2faStatus,
  enable2fa,
  verify2fa,
  disable2fa,
  listSessions,
  revokeSession,
  revokeAllSessions,
  deleteAccount,
} from '../../api';
import type { User } from '../../auth';
import { useSession } from '../../useSession';

/**
 * The full account security dashboard — password, 2FA, sessions, and
 * account deletion. Each section is its own card.
 */
export function SecurityDashboard() {
  const { session } = useSession();

  if (session.state !== 'signedIn') {
    return (
      <div className="security-page">
        <div className="security-container">
          <header className="page-head">
            <h1 className="page-title">Security</h1>
            <p className="page-sub">
              {session.state === 'loading' ? 'Loading…' : 'Sign in to manage your account security.'}
            </p>
          </header>
        </div>
      </div>
    );
  }

  return (
    <div className="security-page">
      <div className="security-container">
        <header className="page-head">
          <h1 className="page-title">Security</h1>
          <p className="page-sub">{session.user.email}</p>
        </header>

        <ProfileSection user={session.user} />
        <PasswordSection />
        <TwoFactorSection />
        <SessionsSection />
        <DangerSection />
      </div>
    </div>
  );
}

/* ---- Profile ---- */

function ProfileSection({ user }: { user: User }) {
  return (
    <section className="security-section">
      <h2 className="security-section-title">
        <Shield className="security-section-icon" size={20} aria-hidden="true" />
        Profile
      </h2>

      <div className="security-profile-row">
        <span className="security-profile-label">Email</span>
        <span className="security-profile-value">{user.email}</span>
      </div>
      <div className="security-profile-row">
        <span className="security-profile-label">Display name</span>
        <span className="security-profile-value">{user.profile.displayName}</span>
      </div>
      <div className="security-profile-row">
        <span className="security-profile-label">Two-factor authentication</span>
        <span className="security-profile-value">
          {user.totpEnabled ? (
            <span style={{ color: 'var(--si-success)', fontWeight: 600 }}>Enabled</span>
          ) : (
            <span style={{ color: 'var(--si-text-soft)' }}>Not enabled</span>
          )}
        </span>
      </div>
    </section>
  );
}

/* ---- Password ---- */

function PasswordSection() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const save = useMutation({
    mutationFn: () => changePassword({ currentPassword, newPassword }),
    onSuccess: (data) => {
      setStatus('success');
      setMessage(data.message);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (err: unknown) => {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Failed to change password.');
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setStatus('error');
      setMessage('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setStatus('error');
      setMessage('New password must be at least 8 characters.');
      return;
    }
    save.mutate();
  }

  const dirty = currentPassword && newPassword && confirmPassword;

  return (
    <section className="security-section">
      <h2 className="security-section-title">
        <Lock className="security-section-icon" size={20} aria-hidden="true" />
        Change Password
      </h2>

      <form onSubmit={handleSubmit}>
        <div className="security-field">
          <label className="security-field-label" htmlFor="sec-current-pw">Current password</label>
          <input
            id="sec-current-pw"
            className="security-input"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            minLength={8}
            maxLength={128}
            required
          />
        </div>

        <div className="security-field">
          <label className="security-field-label" htmlFor="sec-new-pw">New password</label>
          <input
            id="sec-new-pw"
            className="security-input"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
          />
          <p className="security-field-hint">Must be at least 8 characters.</p>
        </div>

        <div className="security-field">
          <label className="security-field-label" htmlFor="sec-confirm-pw">Confirm new password</label>
          <input
            id="sec-confirm-pw"
            className="security-input"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
          />
        </div>

        <button className="security-btn security-btn-primary" type="submit" disabled={!dirty || save.isPending}>
          {save.isPending ? (
            <><Loader2 className="signin-spinner" size={18} strokeWidth={2} aria-hidden="true" /> Changing…</>
          ) : (
            'Change password'
          )}
        </button>

        {status !== 'idle' && (
          <p className={`security-status ${status === 'error' ? 'security-status-error' : 'security-status-success'}`}>
            {message}
          </p>
        )}
      </form>
    </section>
  );
}

/* ---- 2FA ---- */

function TwoFactorSection() {
  const [state, setState] = useState<'idle' | 'enabling' | 'verifying' | 'enabled' | 'disabling'>('idle');
  const [secret, setSecret] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [token, setToken] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [disablePassword, setDisablePassword] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  // Load 2FA status
  const { data: statusData, refetch: refetchStatus } = useQuery({
    queryKey: ['2fa-status'],
    queryFn: get2faStatus,
  });

  useEffect(() => {
    if (statusData?.enabled) setState('enabled');
  }, [statusData]);

  async function generateQrDataUrl(uri: string) {
    try {
      const url = await QRCode.toDataURL(uri, { width: 200, margin: 1 });
      setQrDataUrl(url);
    } catch {
      // QR rendering is best-effort — the text secret is always shown
    }
  }

  async function handleEnable() {
    setIsError(false);
    setMessage('');
    try {
      const result = await enable2fa();
      setSecret(result.secret);
      await generateQrDataUrl(result.qrCodeUri);
      setState('enabling');
    } catch (err) {
      setIsError(true);
      setMessage(err instanceof Error ? err.message : 'Failed to enable 2FA.');
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setIsError(false);
    setMessage('');
    try {
      const result = await verify2fa({ token });
      setRecoveryCodes(result.recoveryCodes);
      setState('enabled');
      setToken('');
      refetchStatus();
    } catch (err) {
      setIsError(true);
      setMessage(err instanceof Error ? err.message : 'Invalid verification code.');
    }
  }

  async function handleDisable(e: FormEvent) {
    e.preventDefault();
    setIsError(false);
    setMessage('');
    try {
      await disable2fa({ password: disablePassword });
      setState('idle');
      setDisablePassword('');
      setRecoveryCodes([]);
      setQrDataUrl('');
      setSecret('');
      setMessage('2FA has been disabled.');
      refetchStatus();
    } catch (err) {
      setIsError(true);
      setMessage(err instanceof Error ? err.message : 'Failed to disable 2FA.');
    }
  }

  return (
    <section className="security-section">
      <h2 className="security-section-title">
        <Key className="security-section-icon" size={20} aria-hidden="true" />
        Two-Factor Authentication
      </h2>

      {state === 'idle' && !statusData?.enabled && (
        <div>
          <div className="security-2fa-status">
            <span className="security-2fa-indicator security-2fa-indicator--off" />
            <span className="security-2fa-label">Not enabled</span>
          </div>
          <button className="security-btn security-btn-primary" onClick={handleEnable}>
            Enable two-factor authentication
          </button>
          {message && (
            <p className={`security-status ${isError ? 'security-status-error' : 'security-status-success'}`}>
              {message}
            </p>
          )}
        </div>
      )}

      {state === 'enabling' && qrDataUrl && (
        <div>
          <div className="security-qr-wrap">
            <img className="security-qr" src={qrDataUrl} alt="QR code for authenticator app" width={200} height={200} />
            <p className="security-qr-label">Scan this QR code with your authenticator app</p>
            <p className="security-field-hint">
              Or enter this key manually:
            </p>
            <code className="security-qr-secret">{secret}</code>
          </div>

          <form onSubmit={handleVerify}>
            <div className="security-field">
              <label className="security-field-label" htmlFor="sec-2fa-token">
                Enter the 6-digit code from your app
              </label>
              <input
                id="sec-2fa-token"
                className="security-input"
                type="text"
                inputMode="numeric"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="000000"
                autoComplete="one-time-code"
                maxLength={6}
                required
              />
            </div>
            <button className="security-btn security-btn-primary" type="submit" disabled={token.length !== 6}>
              Verify and enable
            </button>
          </form>

          {message && (
            <p className={`security-status ${isError ? 'security-status-error' : 'security-status-success'}`}>
              {message}
            </p>
          )}
        </div>
      )}

      {state === 'enabled' && (
        <div>
          <div className="security-2fa-status">
            <span className="security-2fa-indicator security-2fa-indicator--on" />
            <span className="security-2fa-label">Two-factor authentication is enabled</span>
          </div>

          {recoveryCodes.length > 0 && (
            <div>
              <p className="security-field-hint">
                Save these recovery codes in a safe place. Each code can be used once to regain
                access if you lose your authenticator device.
              </p>
              <ul className="security-recovery-codes">
                {recoveryCodes.map((code) => (
                  <li key={code} className="security-recovery-code">{code}</li>
                ))}
              </ul>
              <p className="security-recovery-warning">
                These codes will not be shown again. Store them securely.
              </p>
            </div>
          )}

          <form onSubmit={handleDisable} style={{ marginTop: 'var(--s-xl)' }}>
            <div className="security-field">
              <label className="security-field-label" htmlFor="sec-disable-pw">
                Enter your password to disable 2FA
              </label>
              <input
                id="sec-disable-pw"
                className="security-input"
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                autoComplete="current-password"
                minLength={8}
                maxLength={128}
                required
              />
            </div>
            <button className="security-btn security-btn-danger" type="submit" disabled={disablePassword.length < 8}>
              Disable two-factor authentication
            </button>
          </form>

          {message && (
            <p className={`security-status ${isError ? 'security-status-error' : 'security-status-success'}`}>
              {message}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/* ---- Sessions ---- */

function SessionsSection() {
  const { data: sessions, refetch } = useQuery({
    queryKey: ['sessions'],
    queryFn: listSessions,
  });

  const revoke = useMutation({
    mutationFn: revokeSession,
    onSuccess: () => refetch(),
  });

  const revokeAll = useMutation({
    mutationFn: revokeAllSessions,
    onSuccess: () => refetch(),
  });

  return (
    <section className="security-section">
      <h2 className="security-section-title">
        <Monitor className="security-section-icon" size={20} aria-hidden="true" />
        Active Sessions
      </h2>

      {!sessions || sessions.length === 0 ? (
        <p className="security-field-hint">No active sessions found.</p>
      ) : (
        <>
          {sessions.map((s, i) => (
            <div className={`security-session${i === 0 ? ' security-session-current' : ''}`} key={s.jti}>
              <span className="security-session-icon" aria-hidden="true">
                <Monitor size={18} />
              </span>
              <div className="security-session-detail">
                <div className="security-session-device">{s.device}</div>
                <div className="security-session-meta">
                  {s.ip} &middot; {new Date(s.createdAt).toLocaleString()}
                </div>
              </div>
              {i === 0 ? (
                <span className="security-session-badge">Current</span>
              ) : (
                <button
                  className="security-btn security-btn-ghost"
                  style={{ minHeight: 32, padding: '0 var(--s-md)', fontSize: 'var(--text-caption)' }}
                  onClick={() => revoke.mutate(s.jti)}
                  disabled={revoke.isPending}
                >
                  Revoke
                </button>
              )}
            </div>
          ))}

          {sessions.length > 1 && (
            <div style={{ marginTop: 'var(--s-lg)' }}>
              <button
                className="security-btn security-btn-ghost"
                onClick={() => revokeAll.mutate()}
                disabled={revokeAll.isPending}
              >
                {revokeAll.isPending ? 'Revoking…' : 'Revoke all other sessions'}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/* ---- Danger Zone ---- */

function DangerSection() {
  const [showModal, setShowModal] = useState(false);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const { signOut } = useSession();

  const destroy = useMutation({
    mutationFn: () => deleteAccount({ password }),
    onSuccess: (data) => {
      setMessage(data.message);
      setTimeout(() => signOut(), 1000);
    },
    onError: (err: unknown) => {
      setIsError(true);
      setMessage(err instanceof Error ? err.message : 'Failed to delete account.');
    },
  });

  function handleDelete(e: FormEvent) {
    e.preventDefault();
    destroy.mutate();
  }

  // Close modal on backdrop click
  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) setShowModal(false);
  }

  return (
    <section className="security-section security-danger">
      <h2 className="security-section-title">
        <AlertTriangle className="security-section-icon" size={20} aria-hidden="true" />
        Danger Zone
      </h2>

      <p className="security-danger-text">
        Permanently delete your account and all associated data. This action cannot be undone.
        All your progress, streaks, and learning history will be erased.
      </p>

      <button
        className="security-btn security-btn-danger"
        onClick={() => setShowModal(true)}
      >
        <Trash2 size={16} aria-hidden="true" />
        Delete account
      </button>

      {showModal && (
        <div className="security-modal-backdrop" onClick={handleBackdropClick} ref={modalRef}>
          <div className="security-modal">
            <h3 className="security-modal-title">Delete your account?</h3>
            <p className="security-modal-text">
              This will permanently remove your account, all learning progress, and data.
              This action is irreversible.
            </p>

            <form onSubmit={handleDelete}>
              <div className="security-field">
                <label className="security-field-label" htmlFor="sec-delete-pw">
                  Enter your password to confirm
                </label>
                <input
                  id="sec-delete-pw"
                  className="security-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>

              {message && (
                <p className={`security-status ${isError ? 'security-status-error' : 'security-status-success'}`}>
                  {message}
                </p>
              )}

              <div className="security-modal-actions">
                <button
                  type="button"
                  className="security-btn security-btn-ghost"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="security-btn security-btn-danger"
                  type="submit"
                  disabled={!password || destroy.isPending}
                >
                  {destroy.isPending ? (
                    <><Loader2 className="signin-spinner" size={16} strokeWidth={2} aria-hidden="true" /> Deleting…</>
                  ) : (
                    <><Trash2 size={16} aria-hidden="true" /> Delete my account</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
