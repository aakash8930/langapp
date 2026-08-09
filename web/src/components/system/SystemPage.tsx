import { Link } from '@tanstack/react-router';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/Icon';
import './system.css';

interface SystemPageProps {
  icon: IconName;
  heading: string;
  message: string;
  detail?: string;
  actions?: { label: string; to?: string; onClick?: () => void; primary?: boolean }[];
}

export function SystemPage({ icon, heading, message, detail, actions }: SystemPageProps) {
  return (
    <div className="system-page">
      <div className="system-card glass">
        <div className="system-icon">
          <Icon name={icon} size={48} />
        </div>
        <h1 className="system-heading">{heading}</h1>
        <p className="system-message">{message}</p>
        {detail && <p className="system-detail">{detail}</p>}
        {actions && actions.length > 0 && (
          <div className="system-actions">
            {actions.map((a, i) =>
              a.to ? (
                <Link
                  key={i}
                  className={`btn ${a.primary ? 'btn-primary' : 'btn-secondary'}`}
                  to={a.to}
                >
                  {a.label}
                </Link>
              ) : (
                <button
                  key={i}
                  className={`btn ${a.primary ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={a.onClick}
                >
                  {a.label}
                </button>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
