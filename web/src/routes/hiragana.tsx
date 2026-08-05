import { createFileRoute } from '@tanstack/react-router';

import { fetchKanaCurriculum } from '../api';
import { KanaLibrary } from '../components/library/KanaLibrary';
import { logError } from '../debug';
import { queryKeys } from '../queryKeys';

/**
 * The hiragana chart.
 *
 * A route per script rather than one `/library/$kind`, and the reason is the
 * sidebar: `SidebarItem.to` is typed as `FileRouteTypes['to']` and carries no
 * params, so a parameterised route could not be a nav destination without
 * loosening the type that makes a broken nav link a compile error. Two
 * three-line files are cheaper than that.
 *
 * The screen itself is `KanaLibrary`, shared with `/katakana`.
 *
 * The loader warms the cache and deliberately swallows its own failure: the
 * catalog is public, the component already renders a loading/error/empty set
 * off the same query, and throwing here would replace that with the router's
 * error boundary.
 */
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
  component: () => <KanaLibrary script="hiragana" />,
});
