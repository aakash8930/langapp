import { createFileRoute } from '@tanstack/react-router';

import { ReviewForecast } from '../components/review/ReviewForecast';

export const Route = createFileRoute('/review-forecast')({ component: ReviewForecast });
