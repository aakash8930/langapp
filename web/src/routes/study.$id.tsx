import { createFileRoute } from '@tanstack/react-router';

import { Study } from '../components/Study';

/**
 * The study step — a lesson's items, one at a time, before any question is
 * asked. Unauthenticated like the lesson content itself.
 */
export const Route = createFileRoute('/study/$id')({
  component: StudyRoute,
});

function StudyRoute() {
  const { id } = Route.useParams();
  return <Study lessonId={id} />;
}
