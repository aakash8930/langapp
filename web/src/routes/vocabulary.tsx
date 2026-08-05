import { createFileRoute } from '@tanstack/react-router';

import { VocabularyLibrary } from '../components/library/Corpus';

/**
 * Every word the course teaches.
 *
 * No loader: `useCorpus` fans out over eleven `GET /units/:unit/content` calls
 * and caches the union for an hour under one key, which the Kanji, Grammar and
 * Dictionary screens read too. Putting that in a loader would block the first
 * paint on eleven requests to render a screen whose own loading state is
 * already written.
 */
export const Route = createFileRoute('/vocabulary')({
  component: VocabularyLibrary,
});
