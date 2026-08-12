import { Link } from '@tanstack/react-router';

import { Icon, type IconName } from '../ui/Icon';

export type ReadingSection = 'overview' | 'library' | 'bookmarks' | 'quiz' | 'formats' | 'statistics';

const TABS: { id: ReadingSection; label: string; to: '/read' | '/reading-library' | '/reading-bookmarks' | '/reading-quiz' | '/reading-formats' | '/reading-statistics'; icon: IconName }[] = [
  { id: 'overview', label: 'Overview', to: '/read', icon: 'book-open' },
  { id: 'library', label: 'Library', to: '/reading-library', icon: 'library' },
  { id: 'bookmarks', label: 'Saved', to: '/reading-bookmarks', icon: 'book-marked' },
  { id: 'quiz', label: 'Comprehension quiz', to: '/reading-quiz', icon: 'sparkles' },
  { id: 'formats', label: 'Formats', to: '/reading-formats', icon: 'layers' },
  { id: 'statistics', label: 'Statistics', to: '/reading-statistics', icon: 'trending-up' },
];

export function ReadingTabs({ active }: { active: ReadingSection }) {
  return <nav className="reading-tabs glass" aria-label="Reading sections">{TABS.map((tab) => <Link key={tab.id} className={active === tab.id ? 'is-active' : ''} to={tab.to} aria-current={active === tab.id ? 'page' : undefined}><Icon name={tab.icon} size={16} /> {tab.label}</Link>)}</nav>;
}
