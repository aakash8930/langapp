import { createFileRoute } from '@tanstack/react-router';

import { FlashcardStatistics } from '../components/flashcards/FlashcardStatistics';

export const Route = createFileRoute('/flashcards-statistics')({
  component: FlashcardStatistics,
});
