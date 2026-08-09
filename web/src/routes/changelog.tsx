import { createFileRoute } from '@tanstack/react-router';
import { InfoPage } from '../components/landing/InfoPage';

const RELEASES = [
  { version: 'v1.0', date: '2026-08-08', changes: ['Full admin panel', 'Notification system', 'Subscription billing', 'Settings consolidation', 'Landing page'] },
  { version: 'v0.9', date: '2026-07-28', changes: ['AI Tutor chat', 'Community features', 'Leaderboard', 'Achievements', 'Security dashboard'] },
  { version: 'v0.5', date: '2026-07-15', changes: ['Spaced repetition review', 'Lesson curriculum', 'Vocabulary library', 'User profiles'] },
];

export const Route = createFileRoute('/changelog')({ component: () => (
  <InfoPage title="Changelog" backTo="/">
    {RELEASES.map((r) => (
      <div key={r.version} style={{ marginBottom: 'var(--s-lg)' }}>
        <h2 style={{ margin: 0 }}>{r.version} <span style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-soft)', fontWeight: 400 }}>{r.date}</span></h2>
        <ul>{r.changes.map((c) => <li key={c} style={{ color: 'var(--ink-soft)' }}>{c}</li>)}</ul>
      </div>
    ))}
  </InfoPage>
)});
