import { createFileRoute } from '@tanstack/react-router';

import { ReviewRetention } from '../components/review/ReviewRetention';

export const Route = createFileRoute('/review-retention')({ component: ReviewRetention });
