import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { submitContact } from '../api';
import { InfoPage } from '../components/landing/InfoPage';

export const Route = createFileRoute('/contact')({
  component: ContactPage,
});

function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', message: '', website: '' });
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await submitContact(form);
      setSent(true);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Your message could not be sent. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <InfoPage title="Contact GENKŌ" backTo="/">
      {sent ? (
        <p role="status" style={{ color: 'var(--brand-success)' }}>
          Your message is queued for the support team. We’ll reply by email.
        </p>
      ) : (
        <form className="admin-form" onSubmit={submit}>
          <div className="field">
            <label htmlFor="contact-name">Name</label>
            <input
              id="contact-name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              maxLength={80}
              autoComplete="name"
              disabled={busy}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="contact-email">Email</label>
            <input
              id="contact-email"
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              maxLength={254}
              autoComplete="email"
              disabled={busy}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="contact-message">Message</label>
            <textarea
              id="contact-message"
              rows={7}
              value={form.message}
              onChange={(event) => setForm({ ...form, message: event.target.value })}
              minLength={10}
              maxLength={4_000}
              disabled={busy}
              required
            />
          </div>
          <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px' }}>
            <label htmlFor="contact-website">Website</label>
            <input
              id="contact-website"
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={(event) => setForm({ ...form, website: event.target.value })}
            />
          </div>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Sending…' : 'Send message'}
          </button>
        </form>
      )}
    </InfoPage>
  );
}
