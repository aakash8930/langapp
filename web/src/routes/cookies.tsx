import { createFileRoute } from '@tanstack/react-router';
import { InfoPage } from '../components/landing/InfoPage';

export const Route = createFileRoute('/cookies')({ component: () => (
  <InfoPage title="Cookie Policy" backTo="/">Cookie policy content placeholder.</InfoPage>
)});
