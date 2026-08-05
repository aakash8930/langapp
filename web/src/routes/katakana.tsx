import { createFileRoute } from '@tanstack/react-router';

import { fetchKanaCurriculum } from '../api';
import { KanaLibrary } from '../components/library/KanaLibrary';
import { logError } from '../debug';
import { queryKeys } from '../queryKeys';

/**
 * The katakana chart. See `hiragana.tsx` for why this is a route per script
 * rather than one parameterised `/library/$kind`.
 *
 * Both routes read the same cached response — `/lessons/curriculum` returns
 * every character of both scripts in one payload — so arriving here from
 * `/hiragana` costs nothing.
 */
export const Route = createFileRoute('/katakana')({
  loader: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData({
        queryKey: queryKeys.content.kanaCurriculum,
        queryFn: fetchKanaCurriculum,
      });
    } catch (error: unknown) {
      logError('route', 'katakana loader: kana curriculum failed to load', error);
    }
  },
  component: () => <KanaLibrary script="katakana" />,
});
