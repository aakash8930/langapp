import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchSystemSettings, updateSystemSettings } from '../api';
import { AdminShell } from '../components/admin/AdminShell';

export const Route = createFileRoute('/admin/settings')({
  component: AdminSystemSettings,
});

function AdminSystemSettings() {
  const { data, refetch } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: fetchSystemSettings,
  });

  const [form, setForm] = useState<Record<string, string>>({});

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(form)) {
      parsed[k] = v === 'true' ? true : v === 'false' ? false : v;
    }
    await updateSystemSettings(parsed);
    refetch();
  }

  return (
    <AdminShell>
      <h1 className="admin-heading">System Settings</h1>
      <form className="admin-form" onSubmit={save}>
        <div className="field">
          <label>Maintenance Mode</label>
          <select defaultValue={String(data?.maintenance ?? false)} onChange={(e) => setForm({ ...form, maintenance: e.target.value })}>
            <option value="false">Off</option>
            <option value="true">On</option>
          </select>
        </div>
        <div className="field">
          <label>Site Name</label>
          <input defaultValue={data?.siteName ?? 'GENKŌ'} onChange={(e) => setForm({ ...form, siteName: e.target.value })} />
        </div>
        <button className="btn btn-primary" type="submit">Save Settings</button>
      </form>
    </AdminShell>
  );
}
