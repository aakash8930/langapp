import { createFileRoute } from '@tanstack/react-router';
import { BillingPage } from '../components/billing/BillingPage';

export const Route = createFileRoute('/billing')({
  component: BillingPage,
});
