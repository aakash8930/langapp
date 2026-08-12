import { createFileRoute } from '@tanstack/react-router';

import { SpeakingConversation } from '../components/speaking/SpeakingConversation';

export const Route = createFileRoute('/speaking-conversation')({
  validateSearch: (search: Record<string, unknown>) => ({
    session: typeof search.session === 'string' && search.session ? search.session : undefined,
  }),
  component: SpeakingConversationRoute,
});

function SpeakingConversationRoute() {
  const { session } = Route.useSearch();
  return <SpeakingConversation key={session ?? 'new'} initialSessionId={session} />;
}
