import { createFileRoute } from '@tanstack/react-router';
import { InfoPage } from '../components/landing/InfoPage';

const MILESTONES = [
  { status: 'shipped', items: ['Beginner, N5 & N4 course content', 'Structured lessons and synced progress', 'AI Tutor', 'Speaking and writing practice', 'Private Android APK'] },
  { status: 'progress', items: ['Public-MVP production hardening', 'Android release and update delivery', 'More full-stack acceptance coverage'] },
  { status: 'planned', items: ['Offline lessons', 'iOS distribution', 'Study groups', 'Higher JLPT course levels'] },
];

export const Route = createFileRoute('/roadmap')({ component: () => (
  <InfoPage title="Roadmap" backTo="/">
    {MILESTONES.map((m) => (
      <div key={m.status} style={{ marginBottom: 'var(--s-lg)' }}>
        <h2 style={{ textTransform: 'capitalize', margin: '0 0 var(--s-sm)' }}>{m.status}</h2>
        <ul>
          {m.items.map((item) => <li key={item} style={{ color: 'var(--ink-soft)' }}>{item}</li>)}
        </ul>
      </div>
    ))}
  </InfoPage>
)});
