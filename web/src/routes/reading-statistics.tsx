import { createFileRoute } from '@tanstack/react-router';

import { ReadingStatistics } from '../components/reading/ReadingStatistics';

export const Route = createFileRoute('/reading-statistics')({
  component: ReadingStatistics,
});
