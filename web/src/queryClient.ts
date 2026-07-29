/**
 * The query client and its default options.
 *
 * Defaults are tuned for *this* site, not the React Query defaults — those are
 * designed for a generic CRUD app and would over-refetch everything on focus.
 *
 *   - `staleTime: 30s` for everything — fetches are cheap, but the API runs on
 *     a laptop that sleeps, and a refetch triggered by tab focus is a request
 *     the server can refuse (offline) for no benefit.
 *   - `gcTime: 5 min` — long enough that back-navigation in a quiz doesn't
 *     re-fetch progress / lessons, short enough that an abandoned session does
 *     not hold a cache forever.
 *   - `retry: 0` — `authed()` already retries once on 401 and the contact
 *     retry would double-handle a real authentication problem. The same goes
 *     for offline: the catch in `send()` already produced the right error.
 *   - `refetchOnWindowFocus: false` — see above. The site listens for explicit
 *     mutations and Task #12 will add a real-time push; tab focus is not a
 *     signal that we trust.
 */

import { QueryClient } from '@tanstack/react-query';

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
