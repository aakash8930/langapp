import { createFileRoute } from '@tanstack/react-router';

import { KanaFlashcards } from '../components/practice/KanaFlashcards';

export const Route = createFileRoute('/hiragana-flashcards')({
  component: () => <KanaFlashcards script="hiragana" />,
});
