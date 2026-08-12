import { createFileRoute } from '@tanstack/react-router';

import { ReadingQuiz } from '../components/reading/ReadingQuiz';

export const Route = createFileRoute('/reading-quiz')({
  component: ReadingQuiz,
});
