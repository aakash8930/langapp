import { createFileRoute } from '@tanstack/react-router';
import { InfoPage } from '../components/landing/InfoPage';

export const Route = createFileRoute('/documentation')({ component: () => (
  <InfoPage title="Documentation" backTo="/"><p>API documentation and developer guides coming soon.</p></InfoPage>
)});
