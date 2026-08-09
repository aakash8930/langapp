import { createFileRoute } from '@tanstack/react-router';
import { InfoPage } from '../components/landing/InfoPage';

export const Route = createFileRoute('/affiliates')({ component: () => (
  <InfoPage title="Affiliate Program" backTo="/"><p>Earn commissions by referring learners to GENKŌ. Coming soon.</p></InfoPage>
)});
