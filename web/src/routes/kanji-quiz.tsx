import { createFileRoute } from '@tanstack/react-router';

import { KanjiQuiz } from '../components/practice/KanjiQuiz';

export const Route = createFileRoute('/kanji-quiz')({
  component: KanjiQuiz,
});
