import { createFileRoute } from '@tanstack/react-router';

import { KanaFlashcards } from '../components/practice/KanaFlashcards';

export const Route = createFileRoute('/katakana-flashcards')({
  component: () => <KanaFlashcards script="katakana" />,
});
