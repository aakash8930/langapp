import { createFileRoute } from '@tanstack/react-router';
import { TimedPracticePage } from '../components/practice/PracticeModes';

export const Route = createFileRoute('/timed-practice')({
  component: TimedPracticePage,
});
