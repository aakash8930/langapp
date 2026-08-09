import { createFileRoute } from '@tanstack/react-router';
import { PlansPage } from '../components/billing/PlansPage';

export const Route = createFileRoute('/plans')({
  component: PlansPage,
});
