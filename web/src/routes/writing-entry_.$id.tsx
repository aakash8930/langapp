import { createFileRoute } from '@tanstack/react-router';

import { WritingEntryPage } from '../components/writing/WritingEntryPage';

export const Route = createFileRoute('/writing-entry_/$id')({
  component: WritingEntryRoute,
});

function WritingEntryRoute() {
  const { id } = Route.useParams();
  return <WritingEntryPage key={id} id={id} />;
}
