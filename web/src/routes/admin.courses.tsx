import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { AdminShell } from '../components/admin/AdminShell';
import { DataTable } from '../components/admin/DataTable';
import { authed } from '../api';

export const Route = createFileRoute('/admin/courses')({
  component: AdminCourses,
});

function AdminCourses() {
  const { data, refetch } = useQuery({
    queryKey: ['admin', 'courses'],
    queryFn: () => authed<any>('/admin/courses'),
  });

  const [form, setForm] = useState({ title: '', description: '', unitSlugs: '', status: 'draft', order: 0 });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await authed('/admin/courses', { method: 'POST', body: JSON.stringify({ ...form, unitSlugs: form.unitSlugs.split(',').map((s) => s.trim()).filter(Boolean) }) });
    setForm({ title: '', description: '', unitSlugs: '', status: 'draft', order: 0 });
    refetch();
  }

  async function togglePublish(course: any) {
    await authed(`/admin/courses/${course._id}`, { method: 'PATCH', body: JSON.stringify({ status: course.status === 'published' ? 'draft' : 'published' }) });
    refetch();
  }

  return (
    <AdminShell>
      <h1 className="admin-heading">Course Builder</h1>
      <form className="admin-form" onSubmit={create} style={{ marginBottom: 'var(--s-lg)' }}>
        <div className="field"><label>Title</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
        <div className="field"><label>Description</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="field"><label>Unit Slugs (comma-separated)</label><input value={form.unitSlugs} onChange={(e) => setForm({ ...form, unitSlugs: e.target.value })} placeholder="hiragana-basics, greetings" /></div>
        <div className="field"><label>Status</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="draft">Draft</option><option value="published">Published</option></select></div>
        <button className="btn btn-primary" type="submit">Create Course</button>
      </form>
      <DataTable
        columns={[
          { key: 'title', label: 'Title' },
          {
            key: 'unitSlugs',
            label: 'Units',
            render: (c: any) => (c.unitSlugs ?? []).length,
          },
          {
            key: 'status',
            label: 'Status',
            render: (c: any) => (
              <span className={`admin-badge ${c.status === 'published' ? 'admin-badge--active' : ''}`}>
                {c.status}
              </span>
            ),
          },
          {
            key: 'actions',
            label: '',
            render: (c: any) => (
              <button className="btn btn-secondary btn-sm" onClick={() => togglePublish(c)}>
                {c.status === 'published' ? 'Unpublish' : 'Publish'}
              </button>
            ),
          },
        ]}
        items={data?.items ?? []}
      />
    </AdminShell>
  );
}
