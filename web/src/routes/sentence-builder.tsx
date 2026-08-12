import { createFileRoute } from '@tanstack/react-router';

import { SentenceBuilder } from '../components/writing/SentenceBuilder';

export const Route = createFileRoute('/sentence-builder')({
  component: SentenceBuilder,
});
