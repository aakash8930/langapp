import { createFileRoute } from '@tanstack/react-router';

import { GrammarLibrary } from '../components/library/Corpus';

/** Every pattern the course teaches. Shares the corpus cache — see `vocabulary.tsx`. */
export const Route = createFileRoute('/grammar')({
  component: GrammarLibrary,
});
