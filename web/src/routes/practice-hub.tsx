import { createFileRoute } from '@tanstack/react-router';

import { PracticeHub } from '../components/practice/PracticeHub';

export const Route = createFileRoute('/practice-hub')({
  component: () => <PracticeHub />,
});
