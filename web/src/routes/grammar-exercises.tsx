import { createFileRoute } from '@tanstack/react-router';

import { GrammarExercises } from '../components/practice/GrammarExercises';

export const Route = createFileRoute('/grammar-exercises')({
  component: GrammarExercises,
});
