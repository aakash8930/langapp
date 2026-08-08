import { createFileRoute } from '@tanstack/react-router';

import { ChallengesPage } from '../components/practice/Challenges';

export const Route = createFileRoute('/challenges')({
  component: () => <ChallengesPage />,
});
