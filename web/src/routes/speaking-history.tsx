import { createFileRoute } from '@tanstack/react-router';

import { SpeakingHistory } from '../components/speaking/SpeakingHistory';

export const Route = createFileRoute('/speaking-history')({
  component: SpeakingHistory,
});
