import { createFileRoute } from '@tanstack/react-router';

import { KanjiLibrary } from '../components/library/KanjiLibrary';

/** Every character the course teaches. Shares the corpus cache — see `vocabulary.tsx`. */
export const Route = createFileRoute('/kanji')({
  component: KanjiLibrary,
});
