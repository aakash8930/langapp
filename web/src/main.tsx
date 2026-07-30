import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  createHashHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';

import { NotFound } from './components/NotFound';
import { log, logError } from './debug';
import { createAppQueryClient } from './queryClient';
import { routeTree } from './routeTree.gen';
import './theme.css';
import './app.css';

/**
 * Hash-based history. The web app is served under the Funnel mount path
 * `/learn/`, and `index.html` is loaded once — so without hash routing every
 * path would 404 upstream. Hash-based routing keeps the build as plain static
 * files and works from any directory on any host, the property that already
 * shaped the existing `useRoute()` hook.
 */
const hashHistory = createHashHistory();

/**
 * One `QueryClient` per browser tab. Created here so the route loaders can
 * read it via the router's `context` option — `__root.tsx` wraps the same
 * client in a `QueryClientProvider` so the rest of the app sees it through
 * `useQueryClient`.
 */
const queryClient = createAppQueryClient();

const router = createRouter({
  routeTree,
  history: hashHistory,
  context: { queryClient },

  /*
   * Replaces TanStack's `<p>Not Found</p>`.
   *
   * The default renders two words and logs nothing, so a link pointing at a
   * path the route tree does not contain is indistinguishable from a crash —
   * which is how `#/learn/<id>` survived the router migration and shipped as the
   * first thing a new learner clicked. `NotFound` names the path on screen and
   * in the console. See its own comment.
   */
  defaultNotFoundComponent: NotFound,
});

/*
 * Trace every navigation.
 *
 * `onResolved` fires after the router has settled on a location, so this is the
 * one place that sees both where we went and what matched when we got there.
 * A `matchedRoutes` of just `__root__` means nothing matched — the silent
 * failure this whole pass exists to make loud.
 */
router.subscribe('onResolved', ({ toLocation, fromLocation }) => {
  const matched = router.state.matches.map((match) => match.routeId);
  const missed = matched.length <= 1;

  const detail = {
    to: toLocation.href,
    from: fromLocation?.href ?? null,
    hash: window.location.hash,
    matchedRoutes: matched,
    search: toLocation.search,
    params: router.state.matches.at(-1)?.params ?? {},
  };

  if (missed) logError('nav', `navigated to ${toLocation.href} — NO ROUTE MATCHED`, detail);
  else log('nav', `navigated to ${toLocation.href}`, detail);
});

// A loader that throws, a component that throws during render — both land here.
// The router already surfaces these in its error boundary; this puts them in the
// console with the location attached, which the boundary does not do.
router.subscribe('onBeforeLoad', ({ toLocation }) => {
  log('nav', `loading ${toLocation.href}`);
});

// Type registration — `RouterProvider` looks up the router's types by name
// at compile time, and this call tells the type system what shape `useNavigate`,
// `useLocation`, etc. should report. Required for the typed route APIs.
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('No #root element to mount React into.');

createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
