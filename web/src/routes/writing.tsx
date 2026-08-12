import { createFileRoute } from '@tanstack/react-router';

import { WritingWorkspace } from '../components/writing/WritingWorkspace';

export const Route = createFileRoute('/writing')({
  component: () => <WritingWorkspace kind="practice" />,
});
