import { createFileRoute } from '@tanstack/react-router';
import { InfoPage } from '../components/landing/InfoPage';

export const Route = createFileRoute('/careers')({ component: () => (
  <InfoPage title="Careers" backTo="/"><p>No open positions right now. Check back soon!</p></InfoPage>
)});
