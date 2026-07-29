import { useLocation, useNavigate, useRouter } from '@tanstack/react-router';

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
  const learn = /^#\/learn\/([A-Za-z0-9]+)$/.exec(hash);
  if (learn) return { name: 'home', learn: learn[1] };
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
 * Drive the URL. Writes to `window.location.hash`, which fires `hashchange`
 * and the router's listener picks up.
 */
export function go(route: Route): void {
  window.location.hash =
    route.name === 'lesson'
      ? `#/lesson/${route.id}`
      : route.name === 'study'
        ? `#/study/${route.id}`
        : route.name === 'review'
          ? '#/review'
          : route.learn
            ? `#/learn/${route.learn}`
            : '#/';
}

/**
 * Go back. `history.back()` when there is somewhere to go, otherwise home.
 */
export function goBack(): void {
  if (window.history.length > 1) window.history.back();
  else go({ name: 'home' });
}

// Re-exports so follow-up slices can begin replacing `go(...)` calls with
// typed navigation without changing imports.
export { useNavigate, useRouter };