/**
 * Signin-specific animation helpers, layered on the project's animejs
 * utilities in `motion.ts`.
 */
import { animate, stagger } from 'animejs';

import { motionIsOn } from '../motion';

/** The form card and its fields, staggered as one entrance gesture. */
export function playSigninEntrance(card: Element | null): void {
  if (!card || !motionIsOn()) return;

  const revealables = card.querySelectorAll<HTMLElement>('[data-signin-reveal]');

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

/** A quick shake on a field with a validation error. */
export function shakeInput(input: Element | null): void {
  if (!input || !motionIsOn()) return;

  animate(input, {
    translateX: [0, -6, 6, -6, 6, 0],
    duration: 420,
    ease: 'out(1.5)',
  });
}

/**
 * Fade the card out before navigating to the dashboard. `onDone` fires on
 * completion, or immediately under reduced motion.
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
