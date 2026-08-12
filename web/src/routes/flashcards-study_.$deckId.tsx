import { createFileRoute } from '@tanstack/react-router';

import { FlashcardStudy } from '../components/flashcards/FlashcardStudy';

export const Route = createFileRoute('/flashcards-study_/$deckId')({
  component: StudyPage,
});

function StudyPage() {
  const { deckId } = Route.useParams();
  return <FlashcardStudy deckId={deckId} />;
}
