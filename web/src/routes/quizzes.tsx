import { createFileRoute } from '@tanstack/react-router';

import { QuizLibrary } from '../components/practice/QuizLibrary';

export const Route = createFileRoute('/quizzes')({
  component: QuizLibrary,
});
