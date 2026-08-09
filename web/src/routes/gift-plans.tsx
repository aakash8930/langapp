import { createFileRoute } from '@tanstack/react-router';
import { InfoPage } from '../components/landing/InfoPage';

export const Route = createFileRoute('/gift-plans')({ component: () => (
  <InfoPage title="Gift Plans" backTo="/"><p>Give the gift of Japanese. Gift subscription purchasing coming soon.</p></InfoPage>
)});
