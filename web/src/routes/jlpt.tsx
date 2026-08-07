import { createFileRoute } from '@tanstack/react-router';

import { JLPTDashboard } from '../components/practice/JLPTDashboard';

export const Route = createFileRoute('/jlpt')({
  component: () => <JLPTDashboard />,
});
