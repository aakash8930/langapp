import { Link } from '@tanstack/react-router';

import { Icon, type IconName } from '../ui/Icon';

const TABS: { id: SpeakingSection; label: string; to: '/speaking' | '/speaking-pronunciation' | '/speaking-conversation' | '/speaking-challenges' | '/speaking-history'; icon: IconName }[] = [
  { id: 'overview', label: 'Overview', to: '/speaking', icon: 'mic' },
  { id: 'pronunciation', label: 'Pronunciation', to: '/speaking-pronunciation', icon: 'audio-lines' },
  { id: 'conversation', label: 'AI conversation', to: '/speaking-conversation', icon: 'message-circle' },
  { id: 'challenges', label: 'Challenges', to: '/speaking-challenges', icon: 'trophy' },
  { id: 'history', label: 'History', to: '/speaking-history', icon: 'history' },
];

export type SpeakingSection = 'overview' | 'pronunciation' | 'conversation' | 'challenges' | 'history';

export function SpeakingTabs({ active }: { active: SpeakingSection }) {
  return <nav className="speaking-tabs glass" aria-label="Speaking sections">{TABS.map((tab) => <Link key={tab.id} className={active === tab.id ? 'is-active' : ''} to={tab.to} search={tab.to === '/speaking-conversation' ? {} : undefined} aria-current={active === tab.id ? 'page' : undefined}><Icon name={tab.icon} size={16} /> {tab.label}</Link>)}</nav>;
}
