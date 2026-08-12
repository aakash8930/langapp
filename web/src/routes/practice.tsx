import { createFileRoute } from '@tanstack/react-router';

import { SpeakingConversation } from '../components/speaking/SpeakingConversation';

/** The original AI Tutor URL remains live; Speaking now owns the shared conversation UI. */
export const Route = createFileRoute('/practice')({
  component: SpeakingConversation,
});
