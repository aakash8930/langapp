import { createFileRoute } from '@tanstack/react-router';

import { ListeningLibrary } from '../components/listening/ListeningLibrary';

export const Route = createFileRoute('/listening')({
  component: ListeningLibrary,
});
