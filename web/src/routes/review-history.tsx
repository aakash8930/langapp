import { createFileRoute } from '@tanstack/react-router';

import { ReviewHistory } from '../components/review/ReviewHistory';

export const Route = createFileRoute('/review-history')({ component: ReviewHistory });
