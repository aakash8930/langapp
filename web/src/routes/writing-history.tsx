import { createFileRoute } from '@tanstack/react-router';

import { WritingHistory } from '../components/writing/WritingHistory';

export const Route = createFileRoute('/writing-history')({
  component: WritingHistory,
});
