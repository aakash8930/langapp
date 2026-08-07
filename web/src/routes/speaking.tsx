import { createFileRoute } from '@tanstack/react-router';

import { SpeakingPractice } from '../components/practice/SpeakingPractice';

export const Route = createFileRoute('/speaking')({
  component: () => <SpeakingPractice />,
});
