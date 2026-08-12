import { createFileRoute } from '@tanstack/react-router';

import { ReadingBookmarks } from '../components/reading/ReadingBookmarks';

export const Route = createFileRoute('/reading-bookmarks')({
  component: ReadingBookmarks,
});
