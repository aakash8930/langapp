import { createFileRoute } from '@tanstack/react-router';

import { SentenceBuilderPage } from '../components/practice/SentenceBuilder';

export const Route = createFileRoute('/sentence-builder')({
  component: () => <SentenceBuilderPage />,
});
