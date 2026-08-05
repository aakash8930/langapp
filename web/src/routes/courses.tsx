import { createFileRoute } from '@tanstack/react-router';

import { fetchLessons, groupByUnit } from '../api';
import { CoursePage, type Load } from '../components/course/CoursePage';
import { log, logError } from '../debug';
import { queryKeys } from '../queryKeys';
import { useSession } from '../useSession';

/**
 * The course.
 *
 * This screen was the bottom two-thirds of `/` until the dashboard took that
 * address over, and it was a plain list of unit cards until the course design
 * landed. What did *not* change in either move is the part everything else
 * depends on:
 *
 * **`?learn=<id>` lives here.** It is the only search param the site has, it is
 * written by exactly three callers — the dashboard's Continue card, the end of
 * a lesson, and this page's own Continue button — and all three point at
 * `/courses`. A `learn` param left on `/` is silently dropped by the router and
 * produces the "nothing happened" failure that the navigation rule in CLAUDE.md
 * exists to prevent.
 *
 * Browsing is public: `GET /lessons` needs no token, so this route has no
 * session gate. Signed out, nothing is marked complete and nothing is locked,
 * which is right for a shop window.
 */
export const Route = createFileRoute('/courses')({
  validateSearch: (search: Record<string, unknown>): { learn?: string } => {
    const raw = search['learn'];
    const parsed = typeof raw === 'string' ? { learn: raw } : {};
    // `learn` arriving as anything but a string is silently dropped, and a
    // dropped `learn` means no module opens and nothing scrolls — the same
    // "nothing happened" the wrong URL shape produced.
    if (raw !== undefined && typeof raw !== 'string') {
      logError('nav', 'courses: `learn` search param was not a string — dropped', { raw });
    }
    return parsed;
  },
  loader: async ({ context }): Promise<Load> => {
    try {
      // `ensureQueryData` returns the cached value if fresh, otherwise fetches
      // and stores it. The 30s default stale time means arriving here from the
      // dashboard — which reads the same key for its learning path — is free.
      const lessons = await context.queryClient.ensureQueryData({
        queryKey: queryKeys.lessons.all,
        queryFn: fetchLessons,
      });
      const units = groupByUnit(lessons);
      log('route', 'courses loader: curriculum ready', {
        lessons: lessons.length,
        units: units.map((unit) => `${unit.slug}(${unit.lessons.length})`),
      });
      return { state: 'ready', units };
    } catch (error: unknown) {
      // The loader deliberately resolves rather than throwing, so the page can
      // render its own error state instead of the router's boundary. That also
      // means nothing else would log this.
      logError('route', 'courses loader: curriculum failed to load', error);
      return {
        state: 'error',
        message:
          error instanceof Error ? error.message : 'Something stopped the curriculum loading.',
      };
    }
  },
  component: CoursesPage,
});

function CoursesPage() {
  const data = Route.useLoaderData();
  const { learn } = Route.useSearch();
  const { session } = useSession();

  return (
    <CoursePage
      load={data}
      progress={session.state === 'signedIn' ? session.progress : null}
      signedIn={session.state === 'signedIn'}
      learnId={learn ?? null}
    />
  );
}
