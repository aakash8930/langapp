import { createFileRoute } from '@tanstack/react-router';
import { InfoPage } from '../components/landing/InfoPage';

export const Route = createFileRoute('/refund-policy')({ component: () => (
  <InfoPage title="Refund Policy" backTo="/">Refund policy content placeholder.</InfoPage>
)});
