import { createFileRoute } from '@tanstack/react-router';

import { MissedReviews } from '../components/review/MissedReviews';

export const Route = createFileRoute('/review-missed')({ component: MissedReviews });
