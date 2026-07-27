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
/**
 * `home.learn` names a lesson the home page should open and scroll to.
 *
 * It exists for one flow: finishing a lesson whose successor has not been
 * learned yet. Sending the learner to a bare `#/` would drop them at the top of
 * a six-unit page with no indication of which row mattered — so the route
 * carries the lesson, and the curriculum opens it.
 *
 * It is part of the route rather than component state because it has to survive
 * the navigation: the quiz screen unmounts on the way.
 */
export type Route =
  | { name: 'home'; learn?: string }
  | { name: 'lesson'; id: string }
  /** The teach step — the lesson's items, one at a time, before any question. */
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
 * Leaves a lesson. `history.back()` when there is somewhere to go back to, so
 * the browser's own back button and this button agree — pushing a new entry
 * instead would make Back re-open the lesson you just left.
 */
export function goBack(): void {
  if (window.history.length > 1) window.history.back();
  else go({ name: 'home' });
}
