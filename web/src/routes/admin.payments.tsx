import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { AdminShell } from '../components/admin/AdminShell';
import { DataTable } from '../components/admin/DataTable';
import { fetchInvoices } from '../api';

export const Route = createFileRoute('/admin/payments')({
  component: AdminPayments,
});

function AdminPayments() {
  const { data } = useQuery({
    queryKey: ['billing', 'invoices'],
    queryFn: fetchInvoices,
  });

  const items = data?.items ?? [];

  return (
    <AdminShell>
      <h1 className="admin-heading">Payments</h1>
      <DataTable
        columns={[
          {
            key: 'date',
            label: 'Date',
            render: (inv: any) => new Date(inv.date).toLocaleDateString(),
          },
          { key: 'description', label: 'Description' },
          {
            key: 'amount',
            label: 'Amount',
            render: (inv: any) => `${(inv.amount ?? 0).toLocaleString()} ${(inv.currency ?? 'jpy').toUpperCase()}`,
          },
          { key: 'status', label: 'Status' },
        ]}
        items={items}
      />
    </AdminShell>
  );
}
