import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { fetchAdminUsers } from '../api';
import { AdminShell } from '../components/admin/AdminShell';
import { DataTable } from '../components/admin/DataTable';

export const Route = createFileRoute('/admin/subscriptions')({
  component: AdminSubscriptions,
});

function AdminSubscriptions() {
  const { data } = useQuery({
    queryKey: ['admin', 'users', 1],
    queryFn: () => fetchAdminUsers({ page: 1, limit: 50 }),
  });

  const proUsers = (data?.items ?? []).filter((u: any) => u.plan !== 'free');

  return (
    <AdminShell>
      <h1 className="admin-heading">Subscriptions</h1>
      <DataTable
        columns={[
          { key: 'email', label: 'Email' },
          { key: 'displayName', label: 'Name' },
          { key: 'plan', label: 'Plan' },
          { key: 'status', label: 'Status' },
          {
            key: 'createdAt',
            label: 'Joined',
            render: (u: any) => u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—',
          },
        ]}
        items={proUsers}
      />
    </AdminShell>
  );
}
