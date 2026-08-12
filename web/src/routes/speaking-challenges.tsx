import { createFileRoute } from '@tanstack/react-router';

import { SpeakingChallenges } from '../components/speaking/SpeakingChallenges';

export const Route = createFileRoute('/speaking-challenges')({
  component: SpeakingChallenges,
});
