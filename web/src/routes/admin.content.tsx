import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { fetchAdminContentCounts } from '../api';
import { AdminShell } from '../components/admin/AdminShell';
import { StatCard } from '../components/admin/StatCard';

export const Route = createFileRoute('/admin/content')({
  component: AdminContent,
});

function AdminContent() {
  const { data } = useQuery({
    queryKey: ['admin', 'content', 'counts'],
    queryFn: () => fetchAdminContentCounts(),
  });
  const c = data ?? {};

  return (
    <AdminShell>
      <h1 className="admin-heading">Content</h1>
      <div className="admin-stats">
        <StatCard label="Lessons" value={c.lessons ?? '—'} />
        <StatCard label="Vocabulary" value={c.vocab ?? '—'} />
        <StatCard label="Kanji" value={c.kanji ?? '—'} />
        <StatCard label="Grammar" value={c.grammar ?? '—'} />
        <StatCard label="Kana" value={c.kana ?? '—'} />
      </div>
    </AdminShell>
  );
}
