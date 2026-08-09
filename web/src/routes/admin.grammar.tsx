import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { AdminShell } from '../components/admin/AdminShell';
import { DataTable } from '../components/admin/DataTable';
import { authed } from '../api';

export const Route = createFileRoute('/admin/grammar')({
  component: AdminGrammar,
});

function AdminGrammar() {
  const [page, setPage] = useState(1);
  const { data, refetch } = useQuery({
    queryKey: ['admin', 'grammar-list', page],
    queryFn: () => authed<any>(`/admin/content/grammar/list?page=${page}&limit=20`),
  });
  const [form, setForm] = useState({ title: '', explanation: '', examples: '', jlpt: 'N5' });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await authed('/admin/content/grammar', {
      method: 'POST',
      body: JSON.stringify({
        ...form,
        examples: form.examples.split('\n').filter(Boolean).map((line) => {
          const [sentence, gloss] = line.split('|');
          return { sentence: sentence?.trim() ?? '', gloss: gloss?.trim() ?? '' };
        }),
      }),
    });
    setForm({ title: '', explanation: '', examples: '', jlpt: 'N5' });
    refetch();
  }

  async function remove(id: string) {
    await authed(`/admin/content/grammar/${id}`, { method: 'DELETE' });
    refetch();
  }

  return (
    <AdminShell>
      <h1 className="admin-heading">Grammar Editor</h1>
      <details style={{ marginBottom: 'var(--s-lg)' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 'var(--text-small)', marginBottom: 'var(--s-sm)' }}>Create New</summary>
        <form className="admin-form" onSubmit={create}>
          <div className="field"><label>Title / Pattern</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
          <div className="field"><label>Explanation</label><textarea rows={3} value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} required /></div>
          <div className="field"><label>Examples (one per line: sentence|gloss)</label><textarea rows={4} value={form.examples} onChange={(e) => setForm({ ...form, examples: e.target.value })} /></div>
          <div className="field">
            <label>JLPT</label>
            <select value={form.jlpt} onChange={(e) => setForm({ ...form, jlpt: e.target.value })}>
              {['N5','N4','N3','N2','N1'].map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" type="submit">Create</button>
        </form>
      </details>
      <DataTable
        columns={[
          { key: 'title', label: 'Pattern' }, { key: 'jlpt', label: 'JLPT' },
          { key: 'actions', label: '', render: (g: any) => <button className="btn btn-secondary btn-sm" onClick={() => remove(g.id)}>Delete</button> },
        ]}
        items={data?.items ?? []} total={data?.total} page={page} onPageChange={setPage}
      />
    </AdminShell>
  );
}
