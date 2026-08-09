import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { AdminShell } from '../components/admin/AdminShell';
import { authed } from '../api';

export const Route = createFileRoute('/admin/media')({
  component: AdminMedia,
});

function AdminMedia() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ key: string; size: number } | null>(null);

  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = (e.currentTarget.elements.namedItem('file') as HTMLInputElement).files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    const res = await authed<any>('/admin/media/audio', { method: 'POST', body: formData });
    setResult(res);
    setUploading(false);
    (e.target as HTMLFormElement).reset();
  }

  return (
    <AdminShell>
      <h1 className="admin-heading">Audio Manager</h1>
      <p className="placeholder-note" style={{ marginBottom: 'var(--s-md)' }}>
        Upload audio files for vocabulary and kana pronunciation. Files should be in WAV or MP3 format, up to 5MB.
      </p>
      <form className="admin-form" onSubmit={upload}>
        <div className="field"><label>Audio File</label><input type="file" name="file" accept="audio/wav,audio/mpeg" required /></div>
        <button className="btn btn-primary" type="submit" disabled={uploading}>
          {uploading ? 'Uploading...' : 'Upload Audio'}
        </button>
      </form>
      {result && (
        <div style={{ marginTop: 'var(--s-md)', padding: 'var(--s-md)', background: 'color-mix(in srgb, var(--brand-success) 10%, transparent)', borderRadius: 'var(--radius-md)' }}>
          <p style={{ margin: 0, fontSize: 'var(--text-small)', color: 'var(--brand-success)' }}>Uploaded: {result.key} ({(result.size / 1024).toFixed(1)} KB)</p>
        </div>
      )}
    </AdminShell>
  );
}
