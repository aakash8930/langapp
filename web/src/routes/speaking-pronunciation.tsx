import { createFileRoute } from '@tanstack/react-router';

import { PronunciationPractice } from '../components/speaking/PronunciationPractice';

export const Route = createFileRoute('/speaking-pronunciation')({
  component: PronunciationPractice,
});
