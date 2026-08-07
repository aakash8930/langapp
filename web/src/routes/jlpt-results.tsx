import { createFileRoute } from '@tanstack/react-router';

import { JLPTResults } from '../components/practice/JLPTResults';

export const Route = createFileRoute('/jlpt-results')({
  component: () => <JLPTResults />,
});
