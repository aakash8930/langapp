import { createFileRoute } from '@tanstack/react-router';

import { KanaListening } from '../components/practice/KanaListening';

export const Route = createFileRoute('/hiragana-listening')({
  component: () => <KanaListening script="hiragana" />,
});
