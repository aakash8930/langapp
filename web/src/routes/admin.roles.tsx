import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchRoles, createRole } from '../api';
import { AdminShell } from '../components/admin/AdminShell';
import { DataTable } from '../components/admin/DataTable';

export const Route = createFileRoute('/admin/roles')({
  component: AdminRoles,
});

function AdminRoles() {
  const { data, refetch } = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: fetchRoles,
  });

  const [form, setForm] = useState({ name: '', permissions: 'content.read,content.write,users.read' });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await createRole({ name: form.name, permissions: form.permissions.split(',').map((s) => s.trim()) });
    setForm({ name: '', permissions: '' });
    refetch();
  }

  return (
    <AdminShell>
      <h1 className="admin-heading">Roles & Permissions</h1>
      <form className="admin-form" onSubmit={create} style={{ marginBottom: 'var(--s-lg)' }}>
        <div className="field">
          <label>Role Name</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div className="field">
          <label>Permissions (comma-separated)</label>
          <input value={form.permissions} onChange={(e) => setForm({ ...form, permissions: e.target.value })} />
        </div>
        <button className="btn btn-primary" type="submit">Create Role</button>
      </form>
      <DataTable
        columns={[
          { key: 'name', label: 'Name' },
          {
            key: 'permissions',
            label: 'Permissions',
            render: (r: any) => (r.permissions ?? []).join(', '),
          },
        ]}
        items={data?.items ?? []}
      />
    </AdminShell>
  );
}
