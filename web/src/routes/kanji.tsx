import { createFileRoute } from '@tanstack/react-router';

import { KanjiLibrary } from '../components/library/Corpus';

/** Every character the course teaches. Shares the corpus cache — see `vocabulary.tsx`. */
export const Route = createFileRoute('/kanji')({
  component: KanjiLibrary,
});
