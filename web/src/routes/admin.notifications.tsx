import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { broadcastNotification } from '../api';
import { AdminShell } from '../components/admin/AdminShell';

export const Route = createFileRoute('/admin/notifications')({
  component: AdminNotifications,
});

function AdminNotifications() {
  const [form, setForm] = useState({ type: 'system', title: '', body: '', plan: '' });
  const [sent, setSent] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    await broadcastNotification(form);
    setSent(true);
    setTimeout(() => setSent(false), 3000);
  }

  return (
    <AdminShell>
      <h1 className="admin-heading">Broadcast Notification</h1>
      <form className="admin-form" onSubmit={send}>
        <div className="field">
          <label>Audience Plan (leave empty for all)</label>
          <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}>
            <option value="">All users</option>
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
        <div className="field">
          <label>Type</label>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="system">System</option>
            <option value="event">Event</option>
            <option value="course">Course</option>
            <option value="marketing">Marketing</option>
          </select>
        </div>
        <div className="field">
          <label>Title</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        </div>
        <div className="field">
          <label>Body</label>
          <textarea rows={3} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required />
        </div>
        <button className="btn btn-primary" type="submit">Send Broadcast</button>
        {sent && <p style={{ color: 'var(--brand-success)', fontSize: 'var(--text-small)' }}>Sent!</p>}
      </form>
    </AdminShell>
  );
}
