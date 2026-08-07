import { createFileRoute } from '@tanstack/react-router';

import { KanaWriting } from '../components/practice/KanaWriting';

export const Route = createFileRoute('/katakana-writing')({
  component: () => <KanaWriting script="katakana" />,
});
