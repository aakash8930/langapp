import { Link, useRouter } from '@tanstack/react-router';
import { useEffect } from 'react';

import { logError } from '../debug';

/**
 * What the app shows when a URL matches no route.
 *
 * TanStack Router's built-in answer is `<p>Not Found</p>` — two unstyled words,
 * no console output, no clue which path missed and no way out but the back
 * button. That is what a learner hit on 2026-07-30 clicking "Begin" on the home
 * page, and the report that followed was "just a note Not found and the browser
 * console is empty", which is exactly as much as the default gives you.
 *
 * This replaces it with the three things that were missing:
 *
 *  1. **A `console.error` naming the unmatched path.** Not gated behind the
 *     debug flag — a dead end has to be visible to whoever is looking, first
 *     time, without them knowing a flag exists.
 *  2. **The path, on screen.** The reporter can read it back without opening
 *     devtools, and the hash is what distinguishes a wrong *link* from bad data
 *     behind a right one.
 *  3. **A way out**, so a bad link costs a click instead of the session.
 *
 * Registered as `defaultNotFoundComponent` in `main.tsx`, so it covers both a
 * path matching nothing and any route that throws `notFound()` without
 * supplying its own.
 */
export function NotFound() {
  const router = useRouter();

  // `router.state.location` is the router's idea of where it is; the browser's
  // is in `window.location.hash`. Under hash history they should agree, and
  // logging both means a disagreement — the bug class where a link writes the
  // hash but the router never picks it up — is visible rather than guessed at.
  const routerHref = router.state.location.href;
  const browserHash = window.location.hash;

  useEffect(() => {
    logError('nav', `No route matches ${routerHref}`, {
      routerHref,
      browserHash: window.location.hash,
      // Read off the router rather than hardcoded, so the list cannot go stale
      // as routes are added.
      knownRoutes: Object.keys(router.routesById)
        .filter((id) => id !== '__root__')
        .sort(),
      hint:
        'A hash link pointing at a path the route tree does not contain. Check the href against src/routes/ — a plain <a href="#/…"> is not type-checked, <Link to> is.',
    });
  }, [routerHref, router]);

  return (
    <section className="section">
      <div className="wrap">
        <div className="glass panel note note-error" role="alert">
          <strong>That page doesn’t exist.</strong>
          <span>
            Nothing here answers to <code className="mono">{browserHash || '#/'}</code>. The
            link that brought you here is wrong — it isn’t something you did.
          </span>
          <p className="notfound-actions">
            <Link className="btn btn-primary" to="/">
              Back to the course
            </Link>
            <Link className="link-button" to="/review">
              Go to reviews
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
