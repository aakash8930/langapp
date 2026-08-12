import { Link } from '@tanstack/react-router';

import { Icon, type IconName } from '../ui/Icon';

export type ReviewSection = 'today' | 'session' | 'missed' | 'history' | 'statistics' | 'heatmap' | 'retention' | 'forecast';

const tabs: { id: ReviewSection; label: string; to: '/review' | '/review-session' | '/review-missed' | '/review-history' | '/review-statistics' | '/review-heatmap' | '/review-retention' | '/review-forecast'; icon: IconName }[] = [
  { id: 'today', label: "Today's Reviews", to: '/review', icon: 'refresh-cw' },
  { id: 'session', label: 'Review Session', to: '/review-session', icon: 'play' },
  { id: 'missed', label: 'Missed Reviews', to: '/review-missed', icon: 'circle-alert' },
  { id: 'history', label: 'History', to: '/review-history', icon: 'history' },
  { id: 'statistics', label: 'Statistics', to: '/review-statistics', icon: 'trending-up' },
  { id: 'heatmap', label: 'Heatmap', to: '/review-heatmap', icon: 'grid' },
  { id: 'retention', label: 'Retention', to: '/review-retention', icon: 'brain' },
  { id: 'forecast', label: 'Forecast', to: '/review-forecast', icon: 'calendar' },
];

export function ReviewTabs({ active }: { active: ReviewSection }) {
  return <nav className="review-tabs glass" aria-label="Review System sections">{tabs.map((tab) => <Link key={tab.id} to={tab.to} className={tab.id === active ? 'is-active' : ''} aria-current={tab.id === active ? 'page' : undefined}><Icon name={tab.icon} size={15} /> {tab.label}</Link>)}</nav>;
}
