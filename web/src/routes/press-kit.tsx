import { createFileRoute } from '@tanstack/react-router';
import { InfoPage } from '../components/landing/InfoPage';

export const Route = createFileRoute('/press-kit')({ component: () => (
  <InfoPage title="Press Kit" backTo="/"><p>Brand assets and press materials available on request.</p></InfoPage>
)});
