import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { fetchAdminStats } from '../api';
import { AdminShell } from '../components/admin/AdminShell';
import { StatCard } from '../components/admin/StatCard';

export const Route = createFileRoute('/admin/')({
  component: AdminIndex,
});

function AdminIndex() {
  const { data } = useQuery({ queryKey: ['admin', 'stats'], queryFn: fetchAdminStats });
  const s = data ?? {};

  return (
    <AdminShell>
      <h1 className="admin-heading">Dashboard</h1>
      <div className="admin-stats">
        <StatCard label="Total Users" value={s.totalUsers ?? '—'} />
        <StatCard label="Active Today" value={s.activeToday ?? '—'} />
        <StatCard label="Open Reports" value={s.pendingContentReports ?? '—'} />
        <StatCard label="User Reports" value={s.pendingUserReports ?? '—'} />
      </div>
    </AdminShell>
  );
}
