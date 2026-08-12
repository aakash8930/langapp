import { createFileRoute } from '@tanstack/react-router';

import { ListeningShadowing } from '../components/listening/ListeningShadowing';

export const Route = createFileRoute('/listening-shadowing')({
  component: ListeningShadowing,
});
