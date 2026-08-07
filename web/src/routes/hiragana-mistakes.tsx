import { createFileRoute } from '@tanstack/react-router';

import { KanaMistakes } from '../components/practice/KanaMistakes';

export const Route = createFileRoute('/hiragana-mistakes')({
  component: () => <KanaMistakes script="hiragana" />,
});
