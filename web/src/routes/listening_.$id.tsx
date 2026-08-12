import { createFileRoute } from '@tanstack/react-router';

import { ListeningDetailPage } from '../components/listening/ListeningDetailPage';

export const Route = createFileRoute('/listening_/$id')({
  component: ListeningDetailRoute,
});

function ListeningDetailRoute() {
  const { id } = Route.useParams();
  return <ListeningDetailPage key={id} id={id} />;
}
