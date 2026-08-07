import { createFileRoute } from '@tanstack/react-router';

import { KanjiWritingPage } from '../components/practice/KanjiWriting';

export const Route = createFileRoute('/kanji-writing')({
  component: () => <KanjiWritingPage />,
});
