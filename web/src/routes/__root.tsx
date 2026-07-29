import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { Header } from '../components/Header';
import { armMotion } from '../motion';
import { createAppQueryClient } from '../queryClient';
import { useSession } from '../useSession';

/**
 * The shape every route loader sees as its `context` argument. Caches the
 * `QueryClient` reference so loaders can call `ensureQueryData` without
 * pulling the cache constructor into every file.
 */
export interface RouterContext {
  queryClient: QueryClient;
}

/**
 * The persistent shell. Mounted once, lives across every navigation.
 *
 * Owns the things that *should not* remount when the learner moves between
 * screens:
 *   - the `<QueryClientProvider>` for every cached fetch,
 *   - the `<Header>` with its live XP/streak numbers,
 *   - the `useSession()` state machine (loading / signed-out / signed-in),
 *   - `armMotion()` — the page-load animation driver.
 *
 * Placeholders for future slices sit in this file on purpose so the slots
 * exist when those slices land:
 *   - `<RealtimeProvider>` (task #12 — WebSocket listener),
 *   - `<BackgroundScene>` (task #14 — 3D background).
 */
export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootShell,
});

function RootShell() {
  // One client per browser tab, retained across navigations. `useState` rather
  // than a module-level singleton so each tab gets its own and a hot reload
  // doesn't collide with a stale one.
  const [queryClient] = useState(createAppQueryClient);
  const { session, signOut } = useSession();

  // `armMotion()` is the page-load driver. It lives in the shell because every
  // screen needs it on first paint, and remounting it on every navigation is
  // exactly what `motion.ts` exists to avoid.
  useEffect(() => {
    armMotion();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Header session={session} onSignOut={signOut} />

      <Outlet />

      {/*
        * Future shell slots, kept empty so the wrapper shape is fixed:
        *   #12 — <RealtimeProvider>
        *   #14 — <BackgroundScene>
        *
        * Each lands here without a refactor.
        */}
    </QueryClientProvider>
  );
}