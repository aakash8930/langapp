import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelSubscription,
  createPortalSession,
  fetchInvoices,
  type GatewayInvoice,
} from '../../api';
import { queryKeys } from '../../queryKeys';
import { useSession } from '../../useSession';
import { Icon } from '../ui/Icon';
import './billing.css';

function dateLabel(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function statusBadge(status: string): string {
  switch (status) {
    case 'active': return 'Active';
    case 'canceled': return 'Canceled';
    case 'past_due': return 'Past Due';
    default: return status;
  }
}

export function BillingPage() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const isSignedIn = session.state === 'signedIn';
  const sub = isSignedIn ? session.user.subscription : undefined;
  const isPremium = isSignedIn && sub?.status === 'active' && sub?.plan !== 'free';

  // Hooks stay above the signed-out return. `enabled` prevents the invoice
  // request, while keeping React's hook order identical across session changes.
  const { data: invoiceData, isLoading: invoicesLoading } = useQuery({
    queryKey: queryKeys.billing.invoices,
    queryFn: fetchInvoices,
    enabled: isPremium,
  });

  const portalMutation = useMutation({
    mutationFn: createPortalSession,
    onSuccess: (result) => {
      window.location.href = result.url;
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (atPeriodEnd: boolean) => cancelSubscription(atPeriodEnd),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.session.me });
    },
  });

  if (!isSignedIn) {
    return (
      <div className="billing-page">
        <p className="placeholder-note">Sign in to manage your subscription.</p>
      </div>
    );
  }

  const invoices = invoiceData?.items ?? [];

  return (
    <div className="billing-page">
      <h1 className="billing-title">Billing & Subscription</h1>

      <section className="card glass billing-card">
        <h2 className="card-title">Current Plan</h2>
        <div className="billing-plan-row">
          <div>
            <span className="billing-plan-name">{sub?.plan === 'free' ? 'Free' : 'Pro'}</span>
            <span className={`billing-status billing-status--${sub?.status ?? 'active'}`}>
              {statusBadge(sub?.status ?? 'active')}
            </span>
          </div>
          {sub?.currentPeriodEnd && (
            <p className="billing-next">Next billing: {dateLabel(sub.currentPeriodEnd)}</p>
          )}
        </div>
        <div className="billing-actions">
          {!isPremium ? (
            <p className="billing-note">All public MVP features are included. No payment method is stored or required.</p>
          ) : (
            <>
              <a className="btn btn-secondary" href="/#/plans">
                Change Plan
              </a>
              {!sub?.cancelAtPeriodEnd ? (
                <button
                  className="btn btn-secondary"
                  onClick={() => cancelMutation.mutate(true)}
                  disabled={cancelMutation.isPending}
                >
                  Cancel at period end
                </button>
              ) : (
                <div className="billing-actions">
                  <p className="billing-note">Subscription will end on {dateLabel(sub.currentPeriodEnd)}.</p>
                  <button className="btn btn-primary" onClick={() => portalMutation.mutate()} disabled={portalMutation.isPending}>Reactivate in billing portal</button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {isPremium && (
        <section className="card glass billing-card">
          <h2 className="card-title">Payment Method</h2>
          <p className="billing-note">Manage your payment method through the billing portal.</p>
          <button
            className="btn btn-secondary"
            onClick={() => portalMutation.mutate()}
            disabled={portalMutation.isPending}
          >
            Update Payment Method
          </button>
        </section>
      )}

      {isPremium && (
        <section className="card glass billing-card">
          <h2 className="card-title">Billing History</h2>
          {invoicesLoading ? (
            <p className="placeholder-note">Loading...</p>
          ) : invoices.length === 0 ? (
            <p className="placeholder-note">No invoices yet.</p>
          ) : (
            <div className="billing-table-wrap">
              <table className="billing-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th className="tabular">Amount</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv: GatewayInvoice) => (
                    <tr key={inv.id}>
                      <td>{dateLabel(inv.date)}</td>
                      <td>{inv.description}</td>
                      <td className="tabular">
                        {inv.amount.toLocaleString()} {inv.currency.toUpperCase()}
                      </td>
                      <td>
                        <span className={`billing-status billing-status--${inv.status}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td>
                        {inv.pdfUrl && (
                          <a
                            href={inv.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="billing-invoice-link"
                          >
                            <Icon name="book-open" size={14} /> View
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
