import { createFileRoute } from '@tanstack/react-router';

import { WritingCorrections } from '../components/writing/WritingCorrections';

export const Route = createFileRoute('/writing-corrections')({
  component: WritingCorrections,
});
