import { createFileRoute } from '@tanstack/react-router';

import { KanaWriting } from '../components/practice/KanaWriting';

export const Route = createFileRoute('/hiragana-writing')({
  component: () => <KanaWriting script="hiragana" />,
});
