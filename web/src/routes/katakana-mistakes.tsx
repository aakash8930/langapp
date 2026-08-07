import { createFileRoute } from '@tanstack/react-router';

import { KanaMistakes } from '../components/practice/KanaMistakes';

export const Route = createFileRoute('/katakana-mistakes')({
  component: () => <KanaMistakes script="katakana" />,
});
