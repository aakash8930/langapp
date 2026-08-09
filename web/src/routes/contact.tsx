import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { InfoPage } from '../components/landing/InfoPage';
import { authed } from '../api';

export const Route = createFileRoute('/contact')({
  component: () => {
    const [form, setForm] = useState({ name: '', email: '', message: '' });
    const [sent, setSent] = useState(false);

    async function submit(e: React.FormEvent) {
      e.preventDefault();
      try { await authed('/admin/notifications/broadcast', { method: 'POST', body: JSON.stringify({ type: 'system', title: `Contact: ${form.name}`, body: `${form.email}\n\n${form.message}` }) }); } catch {}
      setSent(true);
    }

    return (
      <InfoPage title="Contact Us" backTo="/">
        {sent ? (
          <p style={{ color: 'var(--brand-success)' }}>Message sent! We'll get back to you soon.</p>
        ) : (
          <form className="admin-form" onSubmit={submit}>
            <div className="field"><label>Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="field"><label>Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
            <div className="field"><label>Message</label><textarea rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required /></div>
            <button className="btn btn-primary" type="submit">Send Message</button>
          </form>
        )}
      </InfoPage>
    );
  },
});
