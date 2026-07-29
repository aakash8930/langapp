import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  createHashHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';

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
