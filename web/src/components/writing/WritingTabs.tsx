import { Link } from '@tanstack/react-router';

import { Icon, type IconName } from '../ui/Icon';

export type WritingSection = 'practice' | 'essay' | 'builder' | 'feedback' | 'corrections' | 'history';

const TABS: { id: WritingSection; label: string; to: '/writing' | '/writing-essay' | '/sentence-builder' | '/writing-feedback' | '/writing-corrections' | '/writing-history'; icon: IconName }[] = [
  { id: 'practice', label: 'Writing Practice', to: '/writing', icon: 'pen-tool' },
  { id: 'essay', label: 'Essay', to: '/writing-essay', icon: 'scroll-text' },
  { id: 'builder', label: 'Sentence Builder', to: '/sentence-builder', icon: 'layers' },
  { id: 'feedback', label: 'AI Feedback', to: '/writing-feedback', icon: 'bot' },
  { id: 'corrections', label: 'Corrections', to: '/writing-corrections', icon: 'check-circle-2' },
  { id: 'history', label: 'History', to: '/writing-history', icon: 'history' },
];

export function WritingTabs({ active }: { active: WritingSection }) {
  return <nav className="writing-tabs glass" aria-label="Writing sections">{TABS.map((tab) => <Link key={tab.id} className={active === tab.id ? 'is-active' : ''} to={tab.to} aria-current={active === tab.id ? 'page' : undefined}><Icon name={tab.icon} size={15} /> {tab.label}</Link>)}</nav>;
}
