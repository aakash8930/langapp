import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { InfoPage } from '../components/landing/InfoPage';

export const Route = createFileRoute('/terms')({
  component: TermsPage,
});

function TermsPage() {
  const [content, setContent] = useState('');
  useEffect(() => { fetch((import.meta.env.VITE_API_URL ?? '') + '/terms').then(r => r.text()).then(setContent); }, []);

  return (
    <InfoPage title="Terms of Service" backTo="/" backLabel="Home">
      {content ? (
        <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 'var(--text-small)', color: 'var(--ink-soft)', lineHeight: 1.6, background: 'var(--surface)', padding: 'var(--s-lg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)' }}>
          {content}
        </div>
      ) : <p className="placeholder-note">Loading...</p>}
    </InfoPage>
  );
}
