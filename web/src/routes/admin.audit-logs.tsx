import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchAuditLogs } from '../api';
import { AdminShell } from '../components/admin/AdminShell';
import { DataTable } from '../components/admin/DataTable';

export const Route = createFileRoute('/admin/audit-logs')({
  component: AdminAuditLogs,
});

function AdminAuditLogs() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'audit-logs', page],
    queryFn: () => fetchAuditLogs({ page, limit: 30 }),
  });

  return (
    <AdminShell>
      <h1 className="admin-heading">Audit Logs</h1>
      <DataTable
        columns={[
          { key: 'email', label: 'Admin' },
          { key: 'action', label: 'Action' },
          { key: 'resource', label: 'Resource' },
          { key: 'resourceId', label: 'ID' },
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
