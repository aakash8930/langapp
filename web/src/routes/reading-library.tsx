import { createFileRoute } from '@tanstack/react-router';

import { ReadingLibrary } from '../components/reading/ReadingLibrary';

export const Route = createFileRoute('/reading-library')({
  component: ReadingLibrary,
});
