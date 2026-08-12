import { useMemo } from 'react';

import { useBookmarks } from '../../hooks/useBookmarks';
import { useCorpus } from '../library/useCorpus';
import { useWritingStore } from '../writing/useWritingStore';
import { buildConnectedDecks, buildCourseDecks, deckFromLocal } from './flashcardData';
import { useFlashcardDecks } from './useFlashcardDecks';

export function useFlashcardCatalog() {
  const corpus = useCorpus();
  const { bookmarks } = useBookmarks();
  const writing = useWritingStore();
  const local = useFlashcardDecks();
  const courseDecks = useMemo(() => buildCourseDecks(corpus.data?.items ?? []), [corpus.data?.items]);
  const connectedDecks = useMemo(() => buildConnectedDecks(bookmarks, writing.records), [bookmarks, writing.records]);
  const localDecks = useMemo(() => local.decks.map(deckFromLocal), [local.decks]);
  const decks = useMemo(() => [...courseDecks, ...connectedDecks, ...localDecks], [connectedDecks, courseDecks, localDecks]);
  return { corpus, courseDecks, connectedDecks, localDecks, decks, local };
}
