import { createFileRoute } from '@tanstack/react-router';
import { InfoPage } from '../components/landing/InfoPage';

export const Route = createFileRoute('/referral')({ component: () => (
  <InfoPage title="Referral Program" backTo="/"><p>Invite friends and earn rewards. Coming soon.</p></InfoPage>
)});
