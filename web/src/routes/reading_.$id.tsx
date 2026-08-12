import { createFileRoute } from '@tanstack/react-router';

import { InteractiveReader } from '../components/reading/InteractiveReader';

export const Route = createFileRoute('/reading_/$id')({
  component: ReaderRoute,
});

function ReaderRoute() {
  const { id } = Route.useParams();
  return <InteractiveReader key={id} id={id} />;
}
