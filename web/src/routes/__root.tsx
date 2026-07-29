import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { Header } from '../components/Header';
import { armMotion } from '../motion';
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
 * It is deliberately split into two components, and the split is load-bearing —
 * see `ShellContent` below.
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
  /*
   * The client comes from the *router's* context — the one `main.tsx` built and
   * passed to `createRouter` — and is not constructed here.
   *
   * There must be exactly one. Route loaders reach their client through
   * `context.queryClient` and call `ensureQueryData` on it; components reach
   * theirs through this provider. If those are two different clients the app
   * still renders, which is what makes the bug expensive: every loader
   * prefetch warms a cache nothing reads, and each screen silently refetches
   * on mount. Reading it from context is what keeps "one client per tab" true
   * rather than merely intended.
   */
  const { queryClient } = Route.useRouteContext();

  // `armMotion()` is the page-load driver. It lives in the shell because every
  // screen needs it on first paint, and remounting it on every navigation is
  // exactly what `motion.ts` exists to avoid.
  useEffect(() => {
    armMotion();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ShellContent />

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

/**
 * Everything inside the provider, and the reason this is a separate component
 * rather than the body of `RootShell`.
 *
 * `useSession()` calls `useQueryClient()`. React resolves context by walking a
 * component's *ancestors*, so a component can never consume a provider it
 * renders itself — calling `useSession()` in `RootShell` throws "No QueryClient
 * set, use QueryClientProvider to set one" and takes down the whole app, since
 * the root shell is what every route renders into. That shipped and reached
 * production on 2026-07-29.
 *
 * Anything added here that touches the query cache — the realtime and
 * background-scene slots above included — belongs on this side of the
 * boundary, not in `RootShell`.
 */
function ShellContent() {
  const { session, signOut } = useSession();

  return (
    <>
      <Header session={session} onSignOut={signOut} />

      <Outlet />
    </>
  );
}