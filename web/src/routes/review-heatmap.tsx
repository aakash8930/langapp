import { createFileRoute } from '@tanstack/react-router';

import { ReviewHeatmap } from '../components/review/ReviewHeatmap';

export const Route = createFileRoute('/review-heatmap')({ component: ReviewHeatmap });
