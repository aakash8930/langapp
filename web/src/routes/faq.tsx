import { createFileRoute } from '@tanstack/react-router';
import { InfoPage } from '../components/landing/InfoPage';

export const Route = createFileRoute('/faq')({ component: () => (
  <InfoPage title="FAQ" backTo="/">
    {[
      ['Is GENKŌ free?', 'Yes. Every released public-MVP feature is free, with no payment card or trial expiry.'],
      ['Do I need to know Japanese?', 'No. The course starts with hiragana and can recommend a later unit when onboarding shows prior experience.'],
      ['How do lessons work?', 'Lessons combine short explanations with recognition and recall exercises, and save progress after a clean completion.'],
      ['Can I study offline?', 'Not yet. Lessons, account sync, exercises, and AI currently require a connection.'],
      ['What JLPT levels are available?', 'The authored course currently contains beginner, N5, and N4-aligned material. Higher-level choices fall back to N4.'],
      ['Is there a mobile app?', 'An Android APK is available to the current private distribution group. iOS distribution is not available yet.'],
    ].map(([q, a]) => (
      <details key={q} style={{ borderBottom: '1px solid var(--hairline)', padding: 'var(--s-md) 0' }}>
        <summary style={{ fontWeight: 600, cursor: 'pointer', fontSize: 'var(--text-base)' }}>{q}</summary>
        <p style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-small)', lineHeight: 1.6, margin: 'var(--s-sm) 0 0' }}>{a}</p>
      </details>
    ))}
  </InfoPage>
)});
