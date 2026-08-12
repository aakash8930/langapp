import { createFileRoute } from '@tanstack/react-router';

import { GrammarQuiz } from '../components/practice/GrammarQuiz';

export const Route = createFileRoute('/grammar-quiz')({
  component: GrammarQuiz,
});
