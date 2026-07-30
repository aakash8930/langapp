import { useLocation, useNavigate, useRouter } from '@tanstack/react-router';

import { log } from './debug';

/**
 * Compatibility shim for the pre-TanStack-Router call sites.
 *
 * Existing components still call `go({ name: 'lesson', id })` and
 * `goBack()` — same shape as before, same import path. This shim translates the
 * descriptor to `window.location.hash = ...` so the slice ships without
 * rewriting every callsite. The router owns the parse from this hash; the
 * components are migrated one by one to `<Link>` / `useNavigate` in follow-up
 * tasks.
 *
 * **Do not** extend this surface. It is a temporary bridge, not a contract.
 *
 * `useRoute()` is preserved as a hook that returns the current route parsed
 * off the hash, but it is no longer the source of truth — `useLocation()` /
 * `useMatch()` are. Components that used `route.name` should migrate; this
 * shim only honours the *shape* of `Route` for backwards compatibility.
 */
export type Route =
  | { name: 'home'; learn?: string }
  | { name: 'lesson'; id: string }
  | { name: 'study'; id: string }
  | { name: 'review' };

function parse(hash: string): Route {
  if (hash === '#/review') return { name: 'review' };
  const lesson = /^#\/lesson\/([A-Za-z0-9]+)$/.exec(hash);
  if (lesson) return { name: 'lesson', id: lesson[1] };
  const study = /^#\/study\/([A-Za-z0-9]+)$/.exec(hash);
  if (study) return { name: 'study', id: study[1] };

  /*
   * `learn` is a search param on `/`, not a path segment.
   *
   * It was `#/learn/<id>` under the hand-rolled router this file replaced, and
   * `index.tsx`'s `validateSearch` made it `#/?learn=<id>` — but both this parse
   * and `go()` below kept emitting and expecting the old shape until 2026-07-30,
   * so every link built from them landed on "Not Found". The old form is read
   * here as well as the new one because a learner may have it bookmarked or in
   * history; nothing *writes* it any more.
   */
  const queryIndex = hash.indexOf('?');
  if (queryIndex !== -1) {
    const learn = new URLSearchParams(hash.slice(queryIndex + 1)).get('learn');
    if (learn) return { name: 'home', learn };
  }

  const legacyLearn = /^#\/learn\/([A-Za-z0-9]+)$/.exec(hash);
  if (legacyLearn) return { name: 'home', learn: legacyLearn[1] };

  return { name: 'home' };
}

/**
 * Returns the current route, parsed off the hash.
 *
 * Subscribes to the router's location via `useLocation()` so a hash change
 * drives a re-render the way the old `useEffect`+`hashchange` listener did.
 *
 * Components that migrate to TanStack Router should call `useLocation()` /
 * `useMatch()` directly and stop relying on this hook.
 */
export function useRoute(): Route {
  const location = useLocation();
  // `location.href` carries the hash. `parse` is deterministic so calling it
  // every render is cheap.
  return parse(new URL(location.href).hash);
}

/**
 * Drive the URL by assigning `window.location.hash`.
 *
 * This said the router picks the change up via `hashchange`. It does not:
 * `@tanstack/history` listens for `popstate` and patches `history.pushState` /
 * `replaceState`, and there is **no `hashchange` listener anywhere in the
 * stack** — a fragment navigation reaches the router as a `popstate`. The
 * distinction matters if this ever stops working, because the obvious place to
 * look is the wrong one.
 *
 * It is also why `<Link>` is the better tool: it calls `router.navigate`
 * directly instead of going out through the URL and back in.
 */
export function go(route: Route): void {
  const hash =
    route.name === 'lesson'
      ? `#/lesson/${route.id}`
      : route.name === 'study'
        ? `#/study/${route.id}`
        : route.name === 'review'
          ? '#/review'
          : route.learn
            ? // A search param on `/`, matching `index.tsx`'s `validateSearch`.
              // This said `#/learn/${route.learn}` until 2026-07-30, which
              // matches no route — see `parse` above.
              `#/?learn=${encodeURIComponent(route.learn)}`
            : '#/';

  // Every navigation that still goes through the shim, named. `go()` writes the
  // hash directly rather than calling the router, so a wrong string here fails
  // as a silent not-found with no stack — the failure mode this line closes.
  log('nav', `go(${route.name}) → ${hash}`, route);

  window.location.hash = hash;
}

/**
 * Go back. `history.back()` when there is somewhere to go, otherwise home.
 */
export function goBack(): void {
  // `history.length` counts the whole tab's history, not this app's — so a deep
  // link opened in a fresh tab can still take the `back()` branch and leave the
  // site entirely. Logged rather than fixed: which branch ran is the first thing
  // you need when "Back" appears to do nothing.
  log('nav', 'goBack()', { historyLength: window.history.length, from: window.location.hash });

  if (window.history.length > 1) window.history.back();
  else go({ name: 'home' });
}

// Re-exports so follow-up slices can begin replacing `go(...)` calls with
// typed navigation without changing imports.
export { useNavigate, useRouter };