import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchAdminUsers } from '../api';
import { AdminShell } from '../components/admin/AdminShell';
import { DataTable } from '../components/admin/DataTable';

export const Route = createFileRoute('/admin/users')({
  component: AdminUsers,
});

function AdminUsers() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', page],
    queryFn: () => fetchAdminUsers({ page, limit: 20 }),
  });

  return (
    <AdminShell>
      <h1 className="admin-heading">Users</h1>
      <DataTable
        columns={[
          { key: 'email', label: 'Email' },
          { key: 'displayName', label: 'Name' },
          { key: 'plan', label: 'Plan' },
          { key: 'status', label: 'Status' },
          {
            key: 'isAdmin',
            label: 'Role',
            render: (u: any) => u.isAdmin ? <span className="admin-badge admin-badge--admin">Admin</span> : <span className="admin-badge">User</span>,
          },
        ]}
        items={data?.items ?? []}
        total={data?.total}
        page={page}
        onPageChange={setPage}
        isLoading={isLoading}
      />
    </AdminShell>
  );
}
