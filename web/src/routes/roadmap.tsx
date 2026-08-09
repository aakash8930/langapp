import { createFileRoute } from '@tanstack/react-router';
import { InfoPage } from '../components/landing/InfoPage';

const MILESTONES = [
  { status: 'shipped', items: ['Hiragana & Katakana courses', 'Kanji & Vocabulary library', 'Grammar explorer', 'AI Tutor', 'Social features & leagues'] },
  { status: 'progress', items: ['JLPT mock tests', 'Quiz builder', 'Offline mode', 'iOS & Android apps'] },
  { status: 'planned', items: ['Speaking practice with speech recognition', 'Writing stroke-order practice', 'LMS integration for schools', 'Community forums'] },
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
