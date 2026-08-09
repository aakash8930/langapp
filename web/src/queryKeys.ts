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
    /** `GET /me/history` — paginated activity events. */
    history: (params?: Record<string, unknown>) =>
      ['me', 'history', params ?? {}] as const,
  },
  reviews: {
    /** `GET /reviews/due` — the cards the review session consumes. */
    due: ['reviews', 'due'] as const,
  },
  reading: {
    /** `GET /vocab/by-known-kana` — server-filtered, character-safe vocabulary. */
    feed: ['reading', 'by-known-kana'] as const,
  },
  learning: {
    /** `GET /learning/memory-model` — mastery bands and the forgetting curve. */
    memoryModel: ['learning', 'memory-model'] as const,
    /** `GET /learning/analytics` — today's review accuracy and pace. */
    analytics: ['learning', 'analytics'] as const,
  },
  content: {
    /** `GET /lessons/curriculum` — the canonical kana list. Public. */
    kanaCurriculum: ['lessons', 'curriculum'] as const,
    /**
     * Every item the syllabus teaches, across every unit, deduplicated.
     *
     * One key for one derived collection, fetched by `useCorpus` as a fan-out
     * over `GET /units/:unit/content`. Vocabulary, Kanji, Grammar and the
     * dictionary all read *this* entry rather than each running their own
     * fan-out — which is the whole reason it is a single key rather than one
     * per unit.
     */
    corpus: ['content', 'corpus'] as const,
  },
  social: {
    /**
     * `GET /social/leaderboard` — the weekly league bracket.
     *
     * The bare string is what `Leaderboard.tsx` had hard-coded before this key
     * existed, and it is kept rather than renamed so the two callers — that
     * screen and the dashboard's rank tile — go on sharing one cache entry. A
     * tidier key here would have meant two fetches of the same bracket.
     */
    leaderboard: ['leaderboard'] as const,
  },
  notifications: {
    /** `GET /me/notifications` — paginated notification list. */
    list: (params?: Record<string, unknown>) =>
      ['notifications', 'list', params ?? {}] as const,
    /** `GET /me/notifications/unread-count` — badge number. */
    unreadCount: ['notifications', 'unread-count'] as const,
  },
  billing: {
    /** `GET /billing/plans` — public plan list. */
    plans: ['billing', 'plans'] as const,
    /** `GET /me/billing/invoices` — billing history. */
    invoices: ['billing', 'invoices'] as const,
  },
} as const;
