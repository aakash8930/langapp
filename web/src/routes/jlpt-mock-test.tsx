import { createFileRoute } from '@tanstack/react-router';

import { JLPTMockTestPage } from '../components/practice/JLPTMockTest';

export const Route = createFileRoute('/jlpt-mock-test')({
  component: () => <JLPTMockTestPage />,
});
