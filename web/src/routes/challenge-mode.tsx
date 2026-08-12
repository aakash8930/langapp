import { createFileRoute } from '@tanstack/react-router';
import { ChallengeModePage } from '../components/practice/PracticeModes';

export const Route = createFileRoute('/challenge-mode')({
  component: ChallengeModePage,
});
