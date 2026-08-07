import { createFileRoute } from '@tanstack/react-router';

import { ExamHubPage } from '../components/practice/ExamHub';

export const Route = createFileRoute('/exams')({
  component: () => <ExamHubPage />,
});
