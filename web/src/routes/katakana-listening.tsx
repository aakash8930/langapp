import { createFileRoute } from '@tanstack/react-router';

import { KanaListening } from '../components/practice/KanaListening';

export const Route = createFileRoute('/katakana-listening')({
  component: () => <KanaListening script="katakana" />,
});
