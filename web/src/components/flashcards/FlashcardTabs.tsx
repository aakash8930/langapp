import { Link } from '@tanstack/react-router';

import { Icon, type IconName } from '../ui/Icon';

export type FlashcardSection = 'decks' | 'mine' | 'create' | 'shared' | 'queue' | 'statistics';

const TABS: { id: FlashcardSection; label: string; to: '/flashcards' | '/flashcards-my-decks' | '/flashcards-create' | '/flashcards-shared' | '/flashcards-review-queue' | '/flashcards-statistics'; icon: IconName }[] = [
  { id: 'decks', label: 'Decks', to: '/flashcards', icon: 'layers' },
  { id: 'mine', label: 'My Decks', to: '/flashcards-my-decks', icon: 'book-marked' },
  { id: 'create', label: 'Create Deck', to: '/flashcards-create', icon: 'pen-square' },
  { id: 'shared', label: 'Shared Decks', to: '/flashcards-shared', icon: 'users' },
  { id: 'queue', label: 'Review Queue', to: '/flashcards-review-queue', icon: 'refresh-cw' },
  { id: 'statistics', label: 'Statistics', to: '/flashcards-statistics', icon: 'trending-up' },
];

export function FlashcardTabs({ active }: { active: FlashcardSection }) {
  return <nav className="flashcard-tabs glass" aria-label="Flashcard sections">{TABS.map((tab) => <Link key={tab.id} className={active === tab.id ? 'is-active' : ''} to={tab.to} aria-current={active === tab.id ? 'page' : undefined}><Icon name={tab.icon} size={15} /> {tab.label}</Link>)}</nav>;
}
