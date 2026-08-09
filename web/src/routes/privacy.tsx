import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { InfoPage } from '../components/landing/InfoPage';

export const Route = createFileRoute('/privacy')({
  component: PrivacyPage,
});

function PrivacyPage() {
  const [content, setContent] = useState('');
  useEffect(() => { fetch((import.meta.env.VITE_API_URL ?? '') + '/privacy').then(r => r.text()).then(setContent); }, []);

  return (
    <InfoPage title="Privacy Policy" backTo="/" backLabel="Home">
      {content ? (
        <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 'var(--text-small)', color: 'var(--ink-soft)', lineHeight: 1.6, background: 'var(--surface)', padding: 'var(--s-lg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)' }}>
          {content}
        </div>
      ) : <p className="placeholder-note">Loading...</p>}
    </InfoPage>
  );
}
