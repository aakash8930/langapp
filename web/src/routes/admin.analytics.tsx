import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { fetchAdminAnalytics } from '../api';
import { AdminShell } from '../components/admin/AdminShell';
import { StatCard } from '../components/admin/StatCard';

export const Route = createFileRoute('/admin/analytics')({
  component: AdminAnalytics,
});

function AdminAnalytics() {
  const { data } = useQuery({
    queryKey: ['admin', 'analytics'],
    queryFn: fetchAdminAnalytics,
  });
  const a = data ?? {};

  return (
    <AdminShell>
      <h1 className="admin-heading">Analytics</h1>
      <div className="admin-stats">
        <StatCard label="Total Users" value={a.totalUsers ?? '—'} />
        <StatCard label="Pro Users" value={a.proUsers ?? '—'} />
        <StatCard label="Free Users" value={a.freeUsers ?? '—'} />
      </div>
    </AdminShell>
  );
}
