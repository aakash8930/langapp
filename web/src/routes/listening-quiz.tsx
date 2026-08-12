import { createFileRoute } from '@tanstack/react-router';

import { ListeningQuiz } from '../components/listening/ListeningQuiz';

export const Route = createFileRoute('/listening-quiz')({
  component: ListeningQuiz,
});
