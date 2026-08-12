import { createFileRoute } from '@tanstack/react-router';
import { WeakAreasPracticePage } from '../components/practice/PracticeModes';

export const Route = createFileRoute('/weak-areas')({
  component: WeakAreasPracticePage,
});
