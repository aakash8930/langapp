import { createFileRoute } from '@tanstack/react-router';
import { InfoPage } from '../components/landing/InfoPage';

export const Route = createFileRoute('/refund-policy')({ component: RefundPolicy });

function RefundPolicy() {
  return (
    <InfoPage title="Refund Policy" backTo="/" backLabel="Home">
      <p><strong>Effective date: August 16, 2026</strong></p>
      <h2>No paid purchases during the public MVP</h2>
      <p>
        GENKŌ currently provides its released learning features free of charge. Checkout is disabled, no payment
        method is required, and GENKŌ does not create new paid subscriptions. Because there is no purchase, there is
        normally nothing to refund.
      </p>
      <h2>Unexpected or historical charges</h2>
      <p>
        If you believe you were charged by GENKŌ, use the Contact page and include the date, amount, currency, and
        payment reference. Do not send a full card number, password, verification code, or other authentication
        secret. Support will investigate the payment-provider record and explain or reverse an erroneous charge as
        applicable.
      </p>
      <h2>Future paid plans</h2>
      <p>
        A paid launch will publish price, renewal, cancellation, and refund terms before checkout is enabled. No
        future policy will retroactively turn public-MVP access into a paid subscription.
      </p>
    </InfoPage>
  );
}
