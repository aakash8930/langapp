import { useEffect, useState } from 'react';

/**
 * Routing, in thirty lines and no dependency.
 *
 * Hash-based on purpose: it needs no server rewrite rule, so the built site is
 * plain static files that work from any directory on any host — which matters
 * because where this ends up deployed is still an open question.
 *
 * Three routes exist. A router library would be more code than the feature.
 */
export type Route = { name: 'home' } | { name: 'lesson'; id: string } | { name: 'review' };

function parse(hash: string): Route {
  if (hash === '#/review') return { name: 'review' };
  const match = /^#\/lesson\/([A-Za-z0-9]+)$/.exec(hash);
  return match ? { name: 'lesson', id: match[1] } : { name: 'home' };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}

export function go(route: Route): void {
  window.location.hash =
    route.name === 'lesson' ? `#/lesson/${route.id}` : route.name === 'review' ? '#/review' : '#/';
}

/**
 * Leaves a lesson. `history.back()` when there is somewhere to go back to, so
 * the browser's own back button and this button agree — pushing a new entry
 * instead would make Back re-open the lesson you just left.
 */
export function goBack(): void {
  if (window.history.length > 1) window.history.back();
  else go({ name: 'home' });
}
