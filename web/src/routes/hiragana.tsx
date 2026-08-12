import { createFileRoute } from '@tanstack/react-router';

import { fetchKanaCurriculum } from '../api';
import { KanaLibrary } from '../components/library/KanaLibrary';
import { logError } from '../debug';
import { queryKeys } from '../queryKeys';

/** Beginner learning library and practice entry points for hiragana. */
export const Route = createFileRoute('/hiragana')({
  loader: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData({
        queryKey: queryKeys.content.kanaCurriculum,
        queryFn: fetchKanaCurriculum,
      });
    } catch (error: unknown) {
      logError('route', 'hiragana loader: kana curriculum failed to load', error);
    }
  },
  component: HiraganaPage,
});

function HiraganaPage() {
  return <KanaLibrary script="hiragana" />;
}
