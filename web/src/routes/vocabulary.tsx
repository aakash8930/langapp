import { createFileRoute } from '@tanstack/react-router';
import { useMemo } from 'react';

import { VocabBrowse } from '../components/library/VocabBrowse';
import { useBookmarks } from '../hooks/useBookmarks';
import { useVocabLists } from '../hooks/useVocabLists';

export const Route = createFileRoute('/vocabulary')({
  component: VocabRoute,
});

function VocabRoute() {
  const { bookmarks, toggle } = useBookmarks();
  const { lists, addEntry, create } = useVocabLists();
  const bookmarkedIds = useMemo(() => new Set(bookmarks.map((bookmark) => bookmark.id)), [bookmarks]);

  return (
    <VocabBrowse
      bookmarked={bookmarkedIds}
      bookmarks={bookmarks}
      onToggleBookmark={toggle}
      lists={lists.map((list) => ({
        id: list.id,
        name: list.name,
        entries: list.entries.map((entry) => ({ id: entry.id })),
      }))}
      onCreateList={create}
      onAddToList={(listId, entry) => addEntry(listId, { ...entry, addedAt: Date.now() })}
    />
  );
}
