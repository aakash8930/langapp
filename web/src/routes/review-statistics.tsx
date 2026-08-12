import { createFileRoute } from '@tanstack/react-router';

import { ReviewStatistics } from '../components/review/ReviewStatistics';

export const Route = createFileRoute('/review-statistics')({ component: ReviewStatistics });
