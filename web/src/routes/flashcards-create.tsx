import { createFileRoute } from '@tanstack/react-router';

import { DeckEditor } from '../components/flashcards/DeckEditor';

export const Route = createFileRoute('/flashcards-create')({
  component: DeckEditor,
});
