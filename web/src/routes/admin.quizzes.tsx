import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { AdminShell } from '../components/admin/AdminShell';
import { DataTable } from '../components/admin/DataTable';
import { authed } from '../api';

export const Route = createFileRoute('/admin/quizzes')({
  component: AdminQuizzes,
});

function AdminQuizzes() {
  const [page, setPage] = useState(1);
  const { data, refetch } = useQuery({
    queryKey: ['admin', 'quizzes', page],
    queryFn: () => authed<any>(`/admin/quizzes?page=${page}&limit=20`),
  });

  const [form, setForm] = useState({ title: '', description: '', jlptLevel: 'N5', tags: '', status: 'draft' });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await authed('/admin/quizzes', {
      method: 'POST',
      body: JSON.stringify({ ...form, tags: form.tags.split(',').map((s) => s.trim()).filter(Boolean), questions: [] }),
    });
    setForm({ title: '', description: '', jlptLevel: 'N5', tags: '', status: 'draft' });
    refetch();
  }

  async function remove(id: string) {
    await authed(`/admin/quizzes/${id}`, { method: 'DELETE' });
    refetch();
  }

  return (
    <AdminShell>
      <h1 className="admin-heading">Quiz Builder</h1>
      <form className="admin-form" onSubmit={create} style={{ marginBottom: 'var(--s-lg)' }}>
        <div className="field"><label>Title</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
        <div className="field"><label>Description</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="field"><label>JLPT Level</label>
          <select value={form.jlptLevel} onChange={(e) => setForm({ ...form, jlptLevel: e.target.value })}>
            {['N5','N4','N3','N2','N1','any'].map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div className="field"><label>Tags</label><input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></div>
        <button className="btn btn-primary" type="submit">Create Quiz</button>
      </form>
      <DataTable
        columns={[
          { key: 'title', label: 'Title' },
          { key: 'jlptLevel', label: 'JLPT' },
          { key: 'status', label: 'Status' },
          {
            key: 'questions',
            label: 'Questions',
            render: (q: any) => (q.questions ?? []).length,
          },
          {
            key: 'actions',
            label: '',
            render: (q: any) => <button className="btn btn-secondary btn-sm" onClick={() => remove(q._id)}>Delete</button>,
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
