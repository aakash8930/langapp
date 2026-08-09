/**
 * Signup-specific animation helpers, layered on the project's animejs
 * utilities in `motion.ts`.
 *
 * `motionIsOn()` is the single gate — honoured everywhere in this module so
 * that a `prefers-reduced-motion` visitor skips every movement rather than
 * getting a faster one. Under reduced motion the page simply renders in place.
 */
import { animate, stagger } from 'animejs';

import { motionIsOn } from '../motion';

/** The form card and its fields, staggered as one entrance gesture. */
export function playSignupEntrance(card: Element | null): void {
  if (!card || !motionIsOn()) return;

  const revealables = card.querySelectorAll<HTMLElement>('[data-signup-reveal]');

  // The card itself — a fade/scale-in so the takeover feels composed, not
  // abrupt, even when JS is fast and the fields haven't drawn yet.
  animate(card, {
    opacity: [0, 1],
    translateY: [20, 0],
    scale: [0.96, 1],
    duration: 560,
    ease: 'out(3)',
  });

  if (revealables.length > 0) {
    animate([...revealables], {
      opacity: [0, 1],
      translateY: [22, 0],
      duration: 440,
      delay: stagger(44, { start: 140 }),
      ease: 'out(3)',
    });
  }
}

/** A quick shake — used when a field lands with an error after submit. */
export function shakeInput(input: Element | null): void {
  if (!input || !motionIsOn()) return;

  animate(input, {
    translateX: [0, -6, 6, -6, 6, 0],
    duration: 420,
    ease: 'out(1.5)',
  });
}

/**
 * Fade the card out before leaving for the dashboard — the "smooth transition
 * to step 2" (the signed-in app). `onDone` fires on completion, or immediately
 * under reduced motion so the navigate is never delayed.
 */
export function playSuccessTransition(card: Element | null, onDone: () => void): void {
  if (!card || !motionIsOn()) {
    onDone();
    return;
  }

  animate(card, {
    opacity: [1, 0],
    scale: [1, 0.97],
    duration: 380,
    ease: 'out(2)',
    onComplete: onDone,
  });
}
