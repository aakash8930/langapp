import { Link } from '@tanstack/react-router';

import { Icon } from '../ui/Icon';

const FEATURES = [
  { label: 'Course lessons', icon: 'check' as const, to: '/courses' as const },
  { label: 'AI Tutor', icon: 'sparkles' as const, to: '/practice' as const },
  { label: 'Synced progress', icon: 'trending-up' as const, to: '/progress' as const },
];

export function DashboardFooter() {
  return (
    <section className="dashboard-footer-strip glass" aria-label="Japanese proverb and GENKŌ features">
      <div className="dashboard-proverb">
        <span className="dashboard-proverb-mark ja" aria-hidden="true">継続</span>
        <p>
          <strong className="ja">継続は力なり。</strong>
          <span>Keizoku wa chikara nari. — Consistency is power.</span>
        </p>
      </div>
      <ul>
        {FEATURES.map((feature) => (
          <li key={feature.label}>
            <Link to={feature.to}>
              <Icon name={feature.icon} size={14} />
              {feature.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
