import { createRootRoute, Outlet } from '@tanstack/react-router';
import { useEffect } from 'react';

import { Header } from '../components/Header';
import { armMotion } from '../motion';
import { useSession } from '../useSession';

/**
 * The persistent shell. Mounted once, lives across every navigation.
 *
 * Owns the things that *should not* remount when the learner moves between
 * screens:
 *   - the `<Header>` with its live XP/streak numbers,
 *   - the `useSession()` state machine (loading / signed-out / signed-in),
 *   - `armMotion()` — the page-load animation driver.
 *
 * Placeholders for future slices sit in this file on purpose so the slots
 * exist when those slices land:
 *   - `<QueryClientProvider>` (task #10 — TanStack Query),
 *   - `<RealtimeProvider>` (task #12 — WebSocket listener),
 *   - `<BackgroundScene>` (task #14 — 3D background).
 *
 * Each placeholder is a no-op wrapper so the shell shape is stable across
 * slices — no wholesale restructure when one of them lands.
 */
export const Route = createRootRoute({
  component: RootShell,
});

function RootShell() {
  const { session, signOut } = useSession();

  // `armMotion()` is the page-load driver. It lives in the shell because every
  // screen needs it on first paint, and remounting it on every navigation is
  // exactly what `motion.ts` exists to avoid.
  useEffect(() => {
    armMotion();
  }, []);

  return (
    <>
      <Header session={session} onSignOut={signOut} />

      <Outlet />

      {/*
        * Future shell slots, kept empty so the wrapper shape is fixed:
        *   #10 — <QueryClientProvider client={queryClient}>
        *   #12 — <RealtimeProvider>
        *   #14 — <BackgroundScene>
        *
        * Each lands here without a refactor.
        */}
    </>
  );
}