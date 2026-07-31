/**
 * Motion token system.
 *
 * Two groups, both real-valued (unlike elevation and borders, which are
 * metadata-only):
 *
 *   1. `duration` — five semantic durations, all in milliseconds.
 *   2. `easing`   — five cubic-bezier control-point tuples, no platform
 *                    strings attached.
 *
 * Why this file does not contain composed tokens:
 *   The composed transitions Phase 2.2 documented (`motion.transition.hover`,
 *   `motion.transition.press`, `motion.transition.enter`, `motion.transition.exit`,
 *   `motion.transition.swap`, `motion.transition.expand`) are *bindings* of a
 *   duration and an easing into a single intent ("the hover transition").
 *   Those are deliberately not in this file. They live in a future animation
 *   package that composes tokens from this one — keeping durations and easings
 *   independent means a future change to one (e.g. slowing `normal` from 200ms
 *   to 240ms) propagates through every composed transition without an edit to
 *   each one. The animation package is the layer that picks the binding.
 *
 * Why easing is `[x1, y1, x2, y2]` and not a CSS string or RN curve object:
 *   The token is a property of the design, not a property of a platform.
 *   A `cubic-bezier(0.2, 0, 0, 1)` string is web-only; a `Easing.bezier(…)`
 *   object is RN-only. A four-number tuple is both, losslessly — the web
 *   platform adapter (Phase 2.3+) joins it into `cubic-bezier(x1, y1, x2, y2)`
 *   and the native adapter joins it into `Easing.bezier(x1, y1, x2, y2)`.
 *   The token does not pick sides.
 *
 * Why duration is plain `number` (ms) and not a branded type:
 *   Spacing, radius, and duration are all `number`-valued subsystems. The
 *   codebase does not brand them today. Adding a brand to duration only would
 *   create an asymmetry (a future consumer reading `theme.spacing.md` and
 *   `theme.motion.duration.normal` gets two different ways of expressing "a
 *   number from a token"). The brand is a future cross-subsystem refactor;
 *   this phase matches the prior convention.
 *
 * Tree-shaking:
 *   Every duration step and every easing curve is its own `export const`.
 *   A consumer that reads only `duration.normal` and `easing.standard` does
 *   not pull the other four durations or the other four easings into the
 *   output bundle. Verified by the leaf-level shape of the file.
 *
 *   The package.json `sideEffects: false` flag (a Phase 2.3+ setting) makes
 *   the tree-shaking unconditional.
 *
 * Immutability:
 *   Every leaf is `const`. The assembled `duration` and `easing` objects
 *   are `Object.freeze`d at construction. Two layers — compile-time and
 *   runtime — because either one alone has been the cause of a token-system
 *   bug class before (compile-time only allows a smart cast to break it;
 *   runtime only allows a TS-too-loose consumer to mutate).
 */

/* ============================================================================
 * Group: duration
 * ========================================================================== */

/**
 * Zero milliseconds. The unanimated state. A consumer reading this token
 * is asking the platform adapter to skip the transition entirely — not
 * to play a zero-length frame. Reduced-motion surfaces read this token.
 */
export const duration_instant = 0 as const;

/**
 * 100ms. Micro-interactions: a check-mark ticking, a tap state settling,
 * a button's pressed-state colour crossfade. Short enough that a missed
 * frame is invisible; long enough that the eye reads the change.
 */
export const duration_fast = 100 as const;

/**
 * 200ms. The default transition: a fade-in, a slide-in, a content swap.
 * The most-used value in the scale. A change to this value affects every
 * default transition in the product, so the value is reviewed carefully.
 */
export const duration_normal = 200 as const;

/**
 * 300ms. Larger transitions: a panel expanding, a route change, a sheet
 * settling. Slow enough that the eye tracks the motion, fast enough that
 * the user is not waiting.
 */
export const duration_slow = 300 as const;

/**
 * 500ms. Deliberate, narrative transitions: a stage transition, an
 * opening sequence, a celebratory animation. The slowest value in the
 * scale; reaching for it should be a conscious choice — slow enough to
 * feel intentional, slow enough to skip under reduced-motion.
 */
export const duration_slower = 500 as const;

/**
 * The duration step union. Consumers type props as
 * `duration: DurationStep` and read the assembled `duration` object.
 */
export type DurationStep =
  | 'instant'
  | 'fast'
  | 'normal'
  | 'slow'
  | 'slower';

/**
 * The assembled duration scale. A consumer reading
 * `theme.motion.duration.normal` gets the number `200`. Object.frozen
 * at construction so runtime mutation is impossible.
 */
export type Duration = Readonly<Record<DurationStep, number>>;

export const duration: Duration = Object.freeze({
  instant: duration_instant,
  fast: duration_fast,
  normal: duration_normal,
  slow: duration_slow,
  slower: duration_slower,
});

/* ============================================================================
 * Group: easing
 * ========================================================================== */

/**
 * Cubic-bezier control points `[x1, y1, x2, y2]`. The format is
 * deliberately platform-neutral:
 *   - Web maps it to `cubic-bezier(x1, y1, x2, y2)` in CSS.
 *   - React Native maps it to `Easing.bezier(x1, y1, x2, y2)`.
 *   - Animation frameworks that accept a four-tuple accept it directly.
 * The `as const` preserves the literal numeric values as types, so a
 * future adapter can match on them (`if (easing.standard === [0.2, 0, 0, 1])`).
 */
export type EasingCurve = readonly [number, number, number, number];

/**
 * `[0, 0, 1, 1]`. No easing. Used for indeterminate progress, typewriter
 * cursors, and any place the design has no opinion about acceleration.
 */
export const easing_linear: EasingCurve = [0, 0, 1, 1] as const;

/**
 * `[0.4, 0, 0.2, 1]`. Material Design 3's "standard" curve — a balanced
 * ease with slight deceleration. The default ease for general-purpose
 * transitions. The most-used easing in the scale.
 */
export const easing_standard: EasingCurve = [0.4, 0, 0.2, 1] as const;

/**
 * `[0.3, 0, 1, 1]`. Slow start, fast end. Used for an element *leaving*
 * the screen: a closing modal, a dismissing toast, an exiting item. The
 * asymmetry matches the visual — the element accelerates away.
 */
export const easing_accelerate: EasingCurve = [0.3, 0, 1, 1] as const;

/**
 * `[0, 0, 0, 1]`. Fast start, slow end. Used for an element *arriving*
 * on the screen: an opening modal, a sliding-in toast, an entering item.
 * The asymmetry matches the visual — the element decelerates into place.
 */
export const easing_decelerate: EasingCurve = [0, 0, 0, 1] as const;

/**
 * `[0.2, 0, 0, 1]`. Material Design 3's "emphasized" curve — high
 * attention transitions: a primary action, a hero animation, a stage
 * transition. Reads as more deliberate than `standard` without a
 * bounce or overshoot.
 *
 * Coordinates differ from `standard` in the timing weights:
 * `standard` is `[0.4, 0, 0.2, 1]` (gentle in, gentle out), and
 * `emphasized` is `[0.2, 0, 0, 1]` (sharp in, sharp out). The visual
 * reads as "bold but not bouncy" — the body of the motion carries more
 * velocity than `standard` retains.
 */
export const easing_emphasized: EasingCurve = [0.2, 0, 0, 1] as const;

/**
 * The easing step union. Consumers type props as
 * `easing: EasingType` and read the assembled `easing` object.
 *
 * Named `EasingType`, not aliased to `Easing`, because `Easing` is
 * already a module in React Native. A future prop named
 * `easing: Easing` would shadow the import. The longer name keeps
 * the collision in mind for the future component phase.
 */
export type EasingType =
  | 'linear'
  | 'standard'
  | 'accelerate'
  | 'decelerate'
  | 'emphasized';

/**
 * The assembled easing scale. A consumer reading
 * `theme.motion.easing.standard` gets the tuple `[0.2, 0, 0, 1]`.
 * Object.frozen at construction so runtime mutation is impossible.
 */
export type Easing = Readonly<Record<EasingType, EasingCurve>>;

export const easing: Easing = Object.freeze({
  linear: easing_linear,
  standard: easing_standard,
  accelerate: easing_accelerate,
  decelerate: easing_decelerate,
  emphasized: easing_emphasized,
});
