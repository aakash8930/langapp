import { Link, useRouterState } from '@tanstack/react-router';
import { useSession } from '../../useSession';
import './admin.css';

const SECTIONS = [
  { id: '', label: 'Dashboard' },
  { id: 'users', label: 'Users' },
  { id: 'courses', label: 'Courses' },
  { id: 'vocabulary', label: 'Vocabulary' },
  { id: 'kanji', label: 'Kanji' },
  { id: 'grammar', label: 'Grammar' },
  { id: 'content', label: 'Content Stats' },
  { id: 'reports', label: 'Reports' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'subscriptions', label: 'Subscriptions' },
  { id: 'payments', label: 'Payments' },
  { id: 'coupons', label: 'Coupons' },
  { id: 'media', label: 'Media' },
  { id: 'ai', label: 'AI' },
  { id: 'roles', label: 'Roles' },
  { id: 'audit-logs', label: 'Audit Logs' },
  { id: 'settings', label: 'Settings' },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (session.state === 'loading') return <div className="admin-page"><p>Loading...</p></div>;
  if (session.state !== 'signedIn' || !session.user?.isAdmin) {
    return (
      <div className="admin-page">
        <div className="admin-denied">
          <h1>Access Denied</h1>
          <p>You need administrator privileges to access this area.</p>
          <Link className="btn btn-primary" to="/">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <nav className="admin-nav">
        <div className="admin-nav-header">
          <Link to="/admin" className="admin-brand">Admin Panel</Link>
        </div>
        {SECTIONS.map((s) => (
          <Link
            key={s.id}
            to={`/admin/${s.id}` as any}
            className={`admin-nav-item ${pathname === `/admin/${s.id}` || (s.id === '' && pathname === '/admin') ? 'admin-nav-item--active' : ''}`}
          >
            {s.label}
          </Link>
        ))}
        <div className="admin-nav-footer">
          <Link to="/" className="admin-nav-item">← Back to App</Link>
        </div>
      </nav>
      <main className="admin-content">
        {children}
      </main>
    </div>
  );
}
