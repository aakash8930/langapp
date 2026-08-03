/**
 * Centralised TanStack Query keys for this site.
 *
 * Two reasons for putting them in one place:
 *  - A query and the thing that invalidates it have to agree on the key, and
 *    two locations is the natural shape of that bug.
 *  - Surfacing them in dev tools (`window.__queryClient`) is easier when the
 *    keys are a small object rather than strings scattered across call sites.
 *
 * Keys are arrays on purpose so `useQuery` can take a partial prefix; matches
 * use the runtime array equality TanStack uses.
 *
 * Five top-level domains, matching the five API clusters. Leaderboard is
 * social and lives with that module when the route lands.
 */
export const queryKeys = {
  lessons: {
    /** Every lesson, used by the curriculum. Public. */
    all: ['lessons'] as const,
    /** A single lesson with its resolved items. Public. */
    detail: (id: string) => ['lessons', id] as const,
    /** The exercise set for a lesson at a given attempt. Auth-gated. */
    exercises: (lessonId: string, attempt: number) =>
      ['lessons', lessonId, 'exercises', attempt] as const,
  },
  session: {
    /** `GET /me` — who is signed in. */
    me: ['me'] as const,
    /** `GET /me/progress` — XP, streak, due-now, completed lessons. */
    progress: ['me', 'progress'] as const,
  },
  reviews: {
    /** `GET /reviews/due` — the cards the review session consumes. */
    due: ['reviews', 'due'] as const,
  },
  reading: {
    /** `GET /vocab/by-known-kana` — server-filtered, character-safe vocabulary. */
    feed: ['reading', 'by-known-kana'] as const,
  },
} as const;
