import { createFileRoute } from '@tanstack/react-router';

import { ReviewQueue } from '../components/flashcards/ReviewQueue';

export const Route = createFileRoute('/flashcards-review-queue')({
  component: ReviewQueue,
});
