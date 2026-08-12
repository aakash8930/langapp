import { createFileRoute } from '@tanstack/react-router';

import { SpeakingOverview } from '../components/speaking/SpeakingOverview';

export const Route = createFileRoute('/speaking')({
  component: SpeakingOverview,
});
