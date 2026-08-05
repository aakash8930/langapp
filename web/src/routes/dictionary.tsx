import { createFileRoute } from '@tanstack/react-router';

import { DictionarySearch } from '../components/library/Corpus';

/**
 * Search across every kind at once.
 *
 * Named Dictionary because the sidebar is, but it searches *the syllabus* —
 * 1126 items — rather than the language. The screen says so in its own blurb:
 * there is no dictionary API behind this, and a learner who searched a real
 * word and got nothing would otherwise conclude it does not exist in Japanese.
 */
export const Route = createFileRoute('/dictionary')({
  component: DictionarySearch,
});
