import { createFileRoute } from '@tanstack/react-router';

import { WritingFeedback } from '../components/writing/WritingFeedback';

export const Route = createFileRoute('/writing-feedback')({
  component: WritingFeedback,
});
