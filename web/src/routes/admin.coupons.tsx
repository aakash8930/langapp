import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchCoupons, createCoupon } from '../api';
import { AdminShell } from '../components/admin/AdminShell';
import { DataTable } from '../components/admin/DataTable';

export const Route = createFileRoute('/admin/coupons')({
  component: AdminCoupons,
});

function AdminCoupons() {
  const { data, refetch } = useQuery({
    queryKey: ['admin', 'coupons'],
    queryFn: fetchCoupons,
  });

  const [form, setForm] = useState({ code: '', discountType: 'percent', discountValue: 10 });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await createCoupon(form);
    setForm({ code: '', discountType: 'percent', discountValue: 10 });
    refetch();
  }

  return (
    <AdminShell>
      <h1 className="admin-heading">Coupons</h1>
      <form className="admin-form" onSubmit={create} style={{ marginBottom: 'var(--s-lg)' }}>
        <div className="field">
          <label>Code</label>
          <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required />
        </div>
        <div className="field">
          <label>Type</label>
          <select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })}>
            <option value="percent">Percent</option>
            <option value="fixed">Fixed</option>
          </select>
        </div>
        <div className="field">
          <label>Value</label>
          <input type="number" min={1} value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })} required />
        </div>
        <button className="btn btn-primary" type="submit">Create Coupon</button>
      </form>
      <DataTable
        columns={[
          { key: 'code', label: 'Code' },
          { key: 'discountType', label: 'Type' },
          { key: 'discountValue', label: 'Value' },
          { key: 'usedCount', label: 'Used' },
        ]}
        items={data?.items ?? []}
      />
    </AdminShell>
  );
}
