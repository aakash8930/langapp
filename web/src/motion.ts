import { animate, onScroll, stagger, utils } from 'animejs';

/**
 * Motion, in one place.
 *
 * anime.js v4 — note the signature is `animate(targets, params)`, two
 * arguments. Most examples still online are v3's single `anime({ targets })`
 * object and will silently do nothing here.
 *
 * ## Reduced motion is a hard stop, not a shorter duration
 *
 * `prefers-reduced-motion` disables every animation on this page rather than
 * speeding it up — the same rule the Android app follows. That means the
 * reveal-on-scroll elements must never be left hidden: `.reveal` only gets its
 * starting `opacity: 0` when `<html>` carries `js-motion`, and this module is
 * the only thing that sets it. If anime.js fails to load, or someone has asked
 * for less motion, the class is never added and the page renders fully visible.
 */

const prefersReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let armed = false;

/** Call once, as early as possible — before first paint if you can. */
export function armMotion(): void {
  if (armed || prefersReducedMotion()) return;
  document.documentElement.classList.add('js-motion');
  armed = true;
}

/**
 * Fade-and-rise each element as it scrolls into view.
 *
 * `onScroll` with `enter` at 'bottom-=80' fires a little before the element
 * reaches the fold, so the animation is finishing as it arrives rather than
 * starting once it is already being read.
 */
export function revealOnScroll(elements: Element[], options?: { stagger?: number }): void {
  if (!armed) return;

  const step = options?.stagger ?? 60;

  for (const [index, element] of elements.entries()) {
    animate(element, {
      opacity: [0, 1],
      translateY: [18, 0],
      duration: 520,
      delay: index * step,
      // No overshoot — the house style has no bounce, on either platform.
      ease: 'out(3)',
      autoplay: onScroll({ target: element, enter: 'bottom-=80', repeat: false }),
    });
  }
}

/** The hero, which is above the fold and so plays on load rather than on scroll. */
export function playHero(root: ParentNode): void {
  if (!armed) return;

  const cells = [...root.querySelectorAll('[data-hero-cell]')];
  const lines = [...root.querySelectorAll('[data-hero-line]')];

  if (cells.length > 0) {
    animate(cells, {
      opacity: [0, 1],
      translateY: [14, 0],
      scale: [0.94, 1],
      duration: 620,
      delay: stagger(110),
      ease: 'out(3)',
    });
  }

  if (lines.length > 0) {
    animate(lines, {
      opacity: [0, 1],
      translateY: [12, 0],
      duration: 560,
      delay: stagger(90, { start: 260 }),
      ease: 'out(3)',
    });
  }
}

/**
 * Count a number up as it comes into view.
 *
 * Animating a plain object and writing the rounded value out on each frame,
 * because the target is text content rather than a style property.
 */
export function countUp(element: Element, to: number): void {
  if (!armed) {
    element.textContent = String(to);
    return;
  }

  const state = { value: 0 };

  animate(state, {
    value: to,
    duration: 900,
    ease: 'out(3)',
    onUpdate: () => {
      element.textContent = String(utils.round(state.value, 0));
    },
    autoplay: onScroll({ target: element, enter: 'bottom-=40', repeat: false }),
  });
}
