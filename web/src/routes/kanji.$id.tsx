import { createFileRoute } from '@tanstack/react-router';

import { KanjiDetailPage } from '../components/library/KanjiDetailPage';

export const Route = createFileRoute('/kanji/$id')({
  component: KanjiDetailRoute,
});

function KanjiDetailRoute() {
  const { id } = Route.useParams();
  return <KanjiDetailPage id={id} />;
}
