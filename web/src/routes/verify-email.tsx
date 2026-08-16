import { createFileRoute } from '@tanstack/react-router';

import { VerifyEmailPage } from '../components/verify-email/VerifyEmailPage';
import '../styles/verify-email.css';

export const Route = createFileRoute('/verify-email')({
  validateSearch: (
    search: Record<string, unknown>,
  ): { delivery?: 'queued' | 'unavailable' } => ({
    delivery:
      search.delivery === 'queued' || search.delivery === 'unavailable'
        ? search.delivery
        : undefined,
  }),
  component: VerifyEmailRoute,
});

function VerifyEmailRoute() {
  const { delivery } = Route.useSearch();
  return <VerifyEmailPage initialDeliveryStatus={delivery} />;
}
