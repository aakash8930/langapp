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

/**
 * The same count, but starting now rather than on scroll.
 *
 * The end-of-lesson XP is already in view when it mounts — waiting for a scroll
 * that will never come would leave it reading zero, which is exactly the number
 * it must not show.
 */
export function countUpNow(element: Element, to: number): void {
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
  });
}

/**
 * The confetti palette, read from the stylesheet rather than written here.
 *
 * Colour literals belong in `theme.css`; this module is not a component but the
 * reason for the rule is the same — a palette that lives in two places drifts.
 * Read once and cached, because `getComputedStyle` forces layout and a burst
 * would otherwise pay for it forty times.
 */
let confettiPalette: string[] | null = null;

function palette(): string[] {
  if (confettiPalette) return confettiPalette;

  const styles = getComputedStyle(document.documentElement);
  const colours = ['--brand-primary', '--brand-secondary', '--brand-tertiary', '--brand-success']
    .map((token) => styles.getPropertyValue(token).trim())
    .filter((value) => value.length > 0);

  // Never return empty: an unstyled burst of nothing looks like a bug, and this
  // runs before anyone would notice a missing token.
  confettiPalette = colours.length > 0 ? colours : ['#7c3aed'];
  return confettiPalette;
}

/**
 * A short burst of confetti from the centre of `anchor`.
 *
 * Hand-rolled rather than a dependency — this is forty absolutely-positioned
 * divs on a ballistic arc, and a confetti package would be more bytes than the
 * rest of the page's animation put together.
 *
 * The particles live in a `position: fixed` layer appended to `<body>`, not
 * inside the anchor: a burst rendered inside the card it celebrates gets
 * clipped by the card's own `overflow` and rounded corners, which is exactly
 * where confetti wants to escape from.
 *
 * Silent under reduced motion — `armed` is false there, and confetti has no
 * meaningful still frame. Nothing depends on it having run.
 */
export function burstConfetti(anchor: Element, options?: { count?: number }): void {
  if (!armed) return;

  const box = anchor.getBoundingClientRect();
  // A zero-sized rect means the anchor is display:none or not laid out yet;
  // bursting from the top-left corner of the viewport would be worse than not.
  if (box.width === 0 && box.height === 0) return;

  const originX = box.left + box.width / 2;
  const originY = box.top + box.height / 2;
  const count = options?.count ?? 40;
  const colours = palette();

  const layer = document.createElement('div');
  layer.className = 'confetti-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);

  const pieces: HTMLElement[] = [];
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.background = colours[i % colours.length];
    piece.style.left = `${originX}px`;
    piece.style.top = `${originY}px`;
    layer.appendChild(piece);
    pieces.push(piece);
  }

  for (const piece of pieces) {
    // Upward-biased spread, so it reads as a burst rather than an explosion in
    // a vacuum: the arc goes up first and gravity brings it back down.
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
    const distance = 90 + Math.random() * 170;

    animate(piece, {
      translateX: Math.cos(angle) * distance,
      translateY: [
        { to: Math.sin(angle) * distance, duration: 420, ease: 'out(3)' },
        { to: Math.sin(angle) * distance + 260, duration: 780, ease: 'in(2)' },
      ],
      rotate: (Math.random() - 0.5) * 720,
      scale: [{ to: 1, duration: 120 }, { to: 0.6, duration: 1080 }],
      opacity: [{ to: 1, duration: 100 }, { to: 0, duration: 1100, delay: 200 }],
      duration: 1200,
    });
  }

  // One removal for the whole layer rather than a per-particle `onComplete`,
  // so a burst cannot leave orphans behind if a single animation is interrupted.
  window.setTimeout(() => layer.remove(), 1600);
}

/** True when animation is switched on — for anything that needs a still fallback. */
export function motionIsOn(): boolean {
  return armed;
}

/**
 * Scroll to an element by id, **without writing the URL hash**.
 *
 * The site is hash-routed, so the hash is the router's address bar. A plain
 * `<a href="#curriculum">` therefore does two things at once: the browser scrolls
 * to `id="curriculum"`, and the router reads `curriculum` as a *path*, matches no
 * route, and replaces the page with the not-found screen. The scroll lands on
 * content that is being unmounted underneath it.
 *
 * That is the same defect as the `#/learn/<id>` "Begin" button — a hash written
 * by hand that the route tree does not recognise — and it is why in-page
 * navigation on this site cannot use the hash at all. Call this from an
 * `onClick` with `preventDefault()` instead.
 *
 * `focus` moves keyboard focus as well as scrolling, which is what a skip link
 * has to do — scrolling a sighted reader to the section while leaving focus in
 * the header is worse than not having the link. `tabIndex = -1` is set on the
 * target so a non-interactive `<main>` or `<section>` can hold focus at all; it
 * keeps the element out of the tab order.
 *
 * Honours reduced motion for the same reason everything else here does: this
 * module owns that decision.
 */
export function scrollToSection(id: string, options?: { focus?: boolean }): boolean {
  const target = document.getElementById(id);
  if (!target) return false;

  target.scrollIntoView({
    block: 'start',
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
  });

  if (options?.focus) {
    target.tabIndex = -1;
    // `preventScroll` — `scrollIntoView` above already chose the behaviour, and
    // letting focus scroll too overrides the smooth scroll with a jump.
    target.focus({ preventScroll: true });
  }

  return true;
}
