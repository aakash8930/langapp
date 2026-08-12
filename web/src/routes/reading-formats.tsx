import { createFileRoute } from '@tanstack/react-router';

import { ReadingFormats } from '../components/reading/ReadingFormats';

export const Route = createFileRoute('/reading-formats')({
  component: ReadingFormats,
});
