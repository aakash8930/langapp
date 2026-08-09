import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { AdminShell } from '../components/admin/AdminShell';
import { DataTable } from '../components/admin/DataTable';
import { authed } from '../api';

export const Route = createFileRoute('/admin/lessons')({
  component: AdminLessons,
});

function AdminLessons() {
  const [page, setPage] = useState(1);
  const { data, refetch } = useQuery({
    queryKey: ['admin', 'lessons', page],
    queryFn: () => authed<any>(`/admin/content/lessons/list?page=${page}&limit=20`),
  });

  const [form, setForm] = useState({ title: '', unit: '', order: 1, exerciseTypes: 'multipleChoice,wordReading', prerequisiteIds: '' });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await authed('/admin/content/lessons', {
      method: 'POST',
      body: JSON.stringify({
        title: form.title, unit: form.unit, order: Number(form.order),
        exerciseTypes: form.exerciseTypes.split(',').map((s) => s.trim()).filter(Boolean),
        prerequisiteLessonIds: form.prerequisiteIds.split(',').map((s) => s.trim()).filter(Boolean),
        itemRefs: [],
      }),
    });
    setForm({ title: '', unit: '', order: 1, exerciseTypes: 'multipleChoice,wordReading', prerequisiteIds: '' });
    refetch();
  }

  async function remove(id: string) {
    await authed(`/admin/content/lesson/${id}`, { method: 'DELETE' });
    refetch();
  }

  return (
    <AdminShell>
      <h1 className="admin-heading">Lesson Builder</h1>
      <form className="admin-form" onSubmit={create} style={{ marginBottom: 'var(--s-lg)' }}>
        <div className="field"><label>Title</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
        <div className="field"><label>Unit</label><input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} required /></div>
        <div className="field"><label>Order</label><input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} /></div>
        <div className="field"><label>Exercise Types (comma-separated)</label><input value={form.exerciseTypes} onChange={(e) => setForm({ ...form, exerciseTypes: e.target.value })} /></div>
        <button className="btn btn-primary" type="submit">Create Lesson</button>
      </form>
      <DataTable
        columns={[
          { key: 'title', label: 'Title' },
          { key: 'unit', label: 'Unit' },
          { key: 'order', label: 'Order' },
          { key: 'itemCount', label: 'Items' },
          {
            key: 'actions',
            label: '',
            render: (l: any) => <button className="btn btn-secondary btn-sm" onClick={() => remove(l.id)}>Delete</button>,
          },
        ]}
        items={data?.items ?? []}
        total={data?.total}
        page={page}
        onPageChange={setPage}
      />
    </AdminShell>
  );
}
