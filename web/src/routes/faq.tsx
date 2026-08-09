import { createFileRoute } from '@tanstack/react-router';
import { InfoPage } from '../components/landing/InfoPage';

export const Route = createFileRoute('/faq')({ component: () => (
  <InfoPage title="FAQ" backTo="/">
    {[
      ['Is GENKŌ free?', 'Yes! Free tier includes core lessons, vocabulary, and grammar. Pro unlocks unlimited access.'],
      ['Can I cancel anytime?', 'Yes. Cancel your subscription anytime from your Billing page.'],
      ['What payment methods?', 'UPI, credit/debit cards, netbanking, and wallets via Razorpay.'],
      ['How does SRS work?', 'FSRS algorithm schedules reviews at optimal intervals for long-term retention.'],
      ['Can I study offline?', 'Pro subscribers can download lessons for offline practice.'],
      ['Is there an iOS/Android app?', 'The web app works on all devices. Native apps are on the roadmap.'],
    ].map(([q, a]) => (
      <details key={q} style={{ borderBottom: '1px solid var(--hairline)', padding: 'var(--s-md) 0' }}>
        <summary style={{ fontWeight: 600, cursor: 'pointer', fontSize: 'var(--text-base)' }}>{q}</summary>
        <p style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-small)', lineHeight: 1.6, margin: 'var(--s-sm) 0 0' }}>{a}</p>
      </details>
    ))}
  </InfoPage>
)});
