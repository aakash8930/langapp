import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { fetchContentReports } from '../api';
import { AdminShell } from '../components/admin/AdminShell';
import { DataTable } from '../components/admin/DataTable';

export const Route = createFileRoute('/admin/reports')({
  component: AdminReports,
});

function AdminReports() {
  const { data } = useQuery({
    queryKey: ['admin', 'reports', 'content'],
    queryFn: fetchContentReports,
  });

  return (
    <AdminShell>
      <h1 className="admin-heading">Reports</h1>
      <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600, margin: 'var(--s-lg) 0 var(--s-sm)' }}>Content Reports</h2>
      <DataTable
        columns={[
          { key: 'issueType', label: 'Type' },
          { key: 'itemKind', label: 'Item' },
          { key: 'itemId', label: 'Item ID' },
          { key: 'status', label: 'Status' },
        ]}
        items={data?.items ?? []}
      />
    </AdminShell>
  );
}
