import { createFileRoute } from '@tanstack/react-router';

import { WritingFeedback } from '../components/writing/WritingFeedback';

export const Route = createFileRoute('/writing-feedback_/$id')({
  component: WritingFeedbackRoute,
});

function WritingFeedbackRoute() {
  const { id } = Route.useParams();
  return <WritingFeedback key={id} id={id} />;
}
