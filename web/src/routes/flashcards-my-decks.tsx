import { createFileRoute } from '@tanstack/react-router';

import { MyDecks } from '../components/flashcards/MyDecks';

export const Route = createFileRoute('/flashcards-my-decks')({
  component: MyDecks,
});
