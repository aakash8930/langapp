import { createFileRoute } from '@tanstack/react-router';

import { AIToolsHub } from '../components/practice/AIToolsHub';

export const Route = createFileRoute('/ai-tools')({
  component: () => <AIToolsHub />,
});
