import { createFileRoute, Link } from '@tanstack/react-router';

import { VocabBrowse } from '../components/library/VocabBrowse';
import { useBookmarks } from '../hooks/useBookmarks';
import { useVocabLists } from '../hooks/useVocabLists';

export const Route = createFileRoute('/vocabulary')({
  component: VocabRoute,
});

function VocabRoute() {
  const { bookmarks, toggle, isBookmarked } = useBookmarks();
  const { lists, addEntry } = useVocabLists();

  const bmSet = new Set(bookmarks.map((b) => b.id));

  return (
    <VocabBrowse
      bookmarked={bmSet}
      onToggleBookmark={toggle}
      lists={lists.map((l) => ({ id: l.id, name: l.name }))}
      onAddToList={(listId, entry) => addEntry(listId, entry)}
    />
  );
}
