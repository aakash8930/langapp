import { createFileRoute } from '@tanstack/react-router';
import { DailyPracticePage } from '../components/practice/PracticeModes';

export const Route = createFileRoute('/daily-practice')({
  component: DailyPracticePage,
});
