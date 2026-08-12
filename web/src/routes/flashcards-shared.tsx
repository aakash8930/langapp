import { createFileRoute } from '@tanstack/react-router';

import { SharedDecks } from '../components/flashcards/SharedDecks';

export const Route = createFileRoute('/flashcards-shared')({
  component: SharedDecks,
});
