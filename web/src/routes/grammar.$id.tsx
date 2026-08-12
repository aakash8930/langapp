import { createFileRoute } from '@tanstack/react-router';

import { GrammarDetailPage } from '../components/library/GrammarDetailPage';

export const Route = createFileRoute('/grammar/$id')({
  component: GrammarDetailRoute,
});

function GrammarDetailRoute() {
  const { id } = Route.useParams();
  return <GrammarDetailPage id={id} />;
}
