import { Link } from '@tanstack/react-router';

interface InfoPageProps {
  title: string;
  backTo?: string;
  backLabel?: string;
  children: React.ReactNode;
}

export function InfoPage({ title, backTo = '/', backLabel = 'Back', children }: InfoPageProps) {
  return (
    <div className="info-page">
      {backTo && (
        <Link to={backTo} style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-small)', textDecoration: 'none', marginBottom: 'var(--s-md)', display: 'inline-block' }}>
          ← {backLabel}
        </Link>
      )}
      <h1>{title}</h1>
      {children}
    </div>
  );
}
