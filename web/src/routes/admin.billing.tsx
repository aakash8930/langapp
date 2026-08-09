import { createFileRoute } from '@tanstack/react-router';
import { AdminShell } from '../components/admin/AdminShell';

export const Route = createFileRoute('/admin/billing')({
  component: AdminBilling,
});

function AdminBilling() {
  return (
    <AdminShell>
      <h1 className="admin-heading">Billing</h1>
      <p className="placeholder-note">Subscription and payment management.</p>
    </AdminShell>
  );
}
