import { createFileRoute } from '@tanstack/react-router';

import { ReviewOverview } from '../components/review/ReviewOverview';

export const Route = createFileRoute('/review')({
  component: ReviewOverview,
});
