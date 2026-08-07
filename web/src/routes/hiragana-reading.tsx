import { createFileRoute } from '@tanstack/react-router';

import { KanaReading } from '../components/practice/KanaReading';

export const Route = createFileRoute('/hiragana-reading')({
  component: () => <KanaReading script="hiragana" />,
});
