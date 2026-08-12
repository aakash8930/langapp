import { createFileRoute } from '@tanstack/react-router';

import { DeckEditor } from '../components/flashcards/DeckEditor';

export const Route = createFileRoute('/flashcards-edit_/$deckId')({
  component: EditDeckPage,
});

function EditDeckPage() {
  const { deckId } = Route.useParams();
  return <DeckEditor key={deckId} deckId={deckId} />;
}
