import { createFileRoute } from '@tanstack/react-router';

import { FlashcardsOverview } from '../components/flashcards/FlashcardsOverview';

export const Route = createFileRoute('/flashcards')({
  component: FlashcardsOverview,
});
