import { createFileRoute } from '@tanstack/react-router';

import { KanaReading } from '../components/practice/KanaReading';

export const Route = createFileRoute('/katakana-reading')({
  component: () => <KanaReading script="katakana" />,
});
