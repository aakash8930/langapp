import { createFileRoute } from '@tanstack/react-router';
import { AdminShell } from '../components/admin/AdminShell';

export const Route = createFileRoute('/admin/ai')({
  component: AdminAI,
});

function AdminAI() {
  return (
    <AdminShell>
      <h1 className="admin-heading">AI Configuration</h1>
      <p className="placeholder-note">Model selection and rate limit configuration.</p>
    </AdminShell>
  );
}
