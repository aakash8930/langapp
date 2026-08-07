import { createFileRoute } from '@tanstack/react-router';

import { MixedPracticePage } from '../components/practice/MixedPractice';

export const Route = createFileRoute('/mixed-practice')({
  component: () => <MixedPracticePage />,
});
