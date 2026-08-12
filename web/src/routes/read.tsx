import { createFileRoute } from '@tanstack/react-router';

import { ReadingOverview } from '../components/reading/ReadingOverview';

export const Route = createFileRoute('/read')({
  component: ReadingOverview,
});
