import { createFileRoute } from '@tanstack/react-router';
import { InfoPage } from '../components/landing/InfoPage';

export const Route = createFileRoute('/status')({ component: () => (
  <InfoPage title="System Status" backTo="/"><p>All systems operational.</p></InfoPage>
)});
