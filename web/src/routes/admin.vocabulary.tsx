import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { AdminShell } from '../components/admin/AdminShell';
import { DataTable } from '../components/admin/DataTable';
import { authed } from '../api';

export const Route = createFileRoute('/admin/vocabulary')({
  component: AdminVocab,
});

function AdminVocab() {
  const [page, setPage] = useState(1);
  const { data, refetch } = useQuery({
    queryKey: ['admin', 'vocab-list', page],
    queryFn: () => authed<any>(`/admin/content/vocab/list?page=${page}&limit=20`),
  });
  const [form, setForm] = useState({ lemma: '', reading: '', romaji: '', gloss: '', pos: 'noun', jlpt: 'N5', tags: '' });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await authed('/admin/content/vocab', {
      method: 'POST', body: JSON.stringify({ ...form, tags: form.tags.split(',').map((s) => s.trim()).filter(Boolean) }),
    });
    setForm({ lemma: '', reading: '', romaji: '', gloss: '', pos: 'noun', jlpt: 'N5', tags: '' });
    refetch();
  }

  async function remove(id: string) {
    await authed(`/admin/content/vocab/${id}`, { method: 'DELETE' });
    refetch();
  }

  return (
    <AdminShell>
      <h1 className="admin-heading">Vocabulary Editor</h1>
      <details style={{ marginBottom: 'var(--s-lg)' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 'var(--text-small)', marginBottom: 'var(--s-sm)' }}>Create New</summary>
        <form className="admin-form" onSubmit={create}>
          <div className="field"><label>Lemma</label><input value={form.lemma} onChange={(e) => setForm({ ...form, lemma: e.target.value })} required /></div>
          <div className="field"><label>Reading</label><input value={form.reading} onChange={(e) => setForm({ ...form, reading: e.target.value })} required /></div>
          <div className="field"><label>Romaji</label><input value={form.romaji} onChange={(e) => setForm({ ...form, romaji: e.target.value })} /></div>
          <div className="field"><label>Gloss</label><input value={form.gloss} onChange={(e) => setForm({ ...form, gloss: e.target.value })} required /></div>
          <div className="field">
            <label>POS</label>
            <select value={form.pos} onChange={(e) => setForm({ ...form, pos: e.target.value })}>
              <option value="noun">Noun</option><option value="verb">Verb</option><option value="adj">Adjective</option>
              <option value="adv">Adverb</option><option value="particle">Particle</option>
            </select>
          </div>
          <div className="field">
            <label>JLPT</label>
            <select value={form.jlpt} onChange={(e) => setForm({ ...form, jlpt: e.target.value })}>
              {['N5','N4','N3','N2','N1'].map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div className="field"><label>Tags</label><input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></div>
          <button className="btn btn-primary" type="submit">Create</button>
        </form>
      </details>
      <DataTable
        columns={[
          { key: 'lemma', label: 'Lemma' }, { key: 'reading', label: 'Reading' },
          { key: 'gloss', label: 'Gloss' }, { key: 'pos', label: 'POS' }, { key: 'jlpt', label: 'JLPT' },
          { key: 'actions', label: '', render: (v: any) => <button className="btn btn-secondary btn-sm" onClick={() => remove(v.id)}>Delete</button> },
        ]}
        items={data?.items ?? []} total={data?.total} page={page} onPageChange={setPage}
      />
    </AdminShell>
  );
}
