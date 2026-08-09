import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { AdminShell } from '../components/admin/AdminShell';
import { DataTable } from '../components/admin/DataTable';
import { authed } from '../api';

export const Route = createFileRoute('/admin/kanji')({
  component: AdminKanji,
});

function AdminKanji() {
  const [page, setPage] = useState(1);
  const { data, refetch } = useQuery({
    queryKey: ['admin', 'kanji-list', page],
    queryFn: () => authed<any>(`/admin/content/kanji/list?page=${page}&limit=20`),
  });
  const [form, setForm] = useState({ char: '', on: '', kun: '', meanings: '', strokes: 10, jlpt: 'N5' });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await authed('/admin/content/kanji', {
      method: 'POST',
      body: JSON.stringify({ ...form, on: form.on.split(',').map((s) => s.trim()).filter(Boolean), kun: form.kun.split(',').map((s) => s.trim()).filter(Boolean), meanings: form.meanings.split(',').map((s) => s.trim()).filter(Boolean) }),
    });
    setForm({ char: '', on: '', kun: '', meanings: '', strokes: 10, jlpt: 'N5' });
    refetch();
  }

  async function remove(id: string) {
    await authed(`/admin/content/kanji/${id}`, { method: 'DELETE' });
    refetch();
  }

  return (
    <AdminShell>
      <h1 className="admin-heading">Kanji Editor</h1>
      <details style={{ marginBottom: 'var(--s-lg)' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 'var(--text-small)', marginBottom: 'var(--s-sm)' }}>Create New</summary>
        <form className="admin-form" onSubmit={create}>
          <div className="field"><label>Character</label><input value={form.char} onChange={(e) => setForm({ ...form, char: e.target.value })} maxLength={1} required /></div>
          <div className="field"><label>On-yomi</label><input value={form.on} onChange={(e) => setForm({ ...form, on: e.target.value })} /></div>
          <div className="field"><label>Kun-yomi</label><input value={form.kun} onChange={(e) => setForm({ ...form, kun: e.target.value })} /></div>
          <div className="field"><label>Meanings</label><input value={form.meanings} onChange={(e) => setForm({ ...form, meanings: e.target.value })} required /></div>
          <div className="field"><label>Strokes</label><input type="number" value={form.strokes} onChange={(e) => setForm({ ...form, strokes: Number(e.target.value) })} /></div>
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
          { key: 'char', label: 'Kanji' }, { key: 'strokes', label: 'Strokes' },
          { key: 'jlpt', label: 'JLPT' },
          { key: 'actions', label: '', render: (k: any) => <button className="btn btn-secondary btn-sm" onClick={() => remove(k.id)}>Delete</button> },
        ]}
        items={data?.items ?? []} total={data?.total} page={page} onPageChange={setPage}
      />
    </AdminShell>
  );
}
