/**
 * Radius scale.
 *
 * One scale, seven steps, all in CSS pixels except `full` (which is
 * the pill sentinel — see below). The scale climbs in 4px increments
 * from `sm` (4) through `2xl` (24), with `none` at the floor and
 * `full` at the ceiling.
 *
 * Why this many steps:
 *   - Six steps above `none` is the right number for a design system
 *     that already has standard controls (md), cards (lg), hero
 *     surfaces (xl, 2xl), and pill-shaped affordances (full).
 *     A four-step scale collapses standard controls and cards into
 *     one role; an eight-step scale invents steps the design does
 *     not use.
 *   - The 4px progression (`sm` 4 → `md` 8 → `lg` 12 → `xl` 16 →
 *     `2xl` 24) parallels the spacing scale's base unit. A card's
 *     corner reads as parallel to its padding, which is a property
 *     of having the same base on both scales.
 *
 * Why `full = 9999` and not `full = 50%` or `full = 1e6`:
 *   - 9999 reads as intent ("make this a pill") in a stylesheet, in
 *     a code review, and in a generated CSS dump. A future consumer
 *     who needs the implementation to differ per platform can swap
 *     9999 → `50%` on web and → `9999` on native without changing
 *     the token name; the consumer reads `radius.full`, the
 *     adapter decides what 9999 means.
 *   - The value 9999 is large enough that an element whose smaller
 *     dimension is < 9999 renders as a perfect pill (the engine
 *     clamps to half the smaller side). 50% would also work but
 *     it ties the token to one engine's implementation choice.
 *
 * What radius tokens are NOT:
 *   - Component-specific. There is no `buttonRadius`, no
 *     `cardRadius`, no `modalRadius`, no `badgeRadius`. Components
 *     compose radius tokens at the call site — a button reads
 *     `radius.md`, a card reads `radius.lg`, a hero reads
 *     `radius.2xl`. Those bindings are component decisions.
 *   - A shape language. A future "squircle" or "continuous-corner"
 *     rendering is a platform-adapter choice on top of `radius.md`
 *     for some surfaces, not a new token. The token stays the
 *     rounded-rectangle number.
 *   - Theme-dependent. Radius does not change between light and
 *     dark — a button's corner is 8px in light and 8px in dark.
 *     There is no `lightRadiusMd` / `darkRadiusMd` split.
 *
 * Tree-shaking:
 *   Every leaf is its own `export const`. A consumer that imports
 *   only `radius_md` does not pull `radius_full` at runtime; a
 *   bundler with `sideEffects: false` (Phase 2.3+) drops the
 *   unused leaves from the output bundle entirely.
 *
 * Immutability:
 *   Every leaf is a `const`. The assembled object is `Object.freeze`'d
 *   so a consumer cannot mutate the radius scale at runtime —
 *   `as const` alone would catch a *compile-time* mutation but not
 *   a runtime write like `radius.md = 17`. Two layers, by intent.
 *
 * Type discipline:
 *   The shape below is the contract for the radius scale. Adding
 *   a step is one line here, one line in the assembled object, and
 *   one line in `tokens/index.ts` for the leaf re-export. Forgetting
 *   any of the three is a TS error.
 */

/**
 * The seven steps of the radius scale, in ascending order of
 * `radius.md`/`radius.lg`/etc. (i.e. excluding `none` and `full`,
 * which are sentinels rather than steps).
 *
 * The ordering here is the order consumers should think about when
 * choosing a corner — `none` is the deliberate square edge, `full`
 * is the deliberate pill, and the middle five are the actual
 * progression. Naming is T-shirt sized because the underlying values
 * may shift (the 4px progression is a property of the spacing
 * scale, not a property of radius), and T-shirts stay meaningful
 * when the numbers move.
 */
export type RadiusStep =
  | 'none'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | '2xl'
  | 'full';

/**
 * A single radius value, in CSS pixels.
 *
 * The type is `number`, not `string`. Both consumers in scope
 * (React Native and Vite-built web) treat a numeric length as
 * the canonical form. `radius.full = 9999` is the one value that
 * looks odd as a number — see the file header for why 9999 is
 * chosen over 50% or 1e6.
 */
export type RadiusValue = number;

/* ============================================================================
 * Leaves — one `export const` per step.
 *
 * Every leaf is its own export so consumers can deep-import a single
 * value (e.g. `import { radius_md } from '@genko/design/tokens/radius'`)
 * without pulling the rest of the scale. The aliases in
 * `tokens/index.ts` give every leaf a `radiusMd` PascalCase name too.
 * ========================================================================== */

/**
 * `radius.none` — 0px.
 *
 * Hard-edge surfaces. A divider, a status bar, a full-bleed edge
 * that must align to a screen edge. The deliberate square corner.
 *
 * Use this when the absence of a corner is the design — a divider
 * that rounds into a card is no longer a divider, it's a tab.
 */
export const radius_none: RadiusValue = 0;

/**
 * `radius.sm` — 4px.
 *
 * Subtle rounding. An icon button, a small badge, a tight pill.
 * The smallest value that reads as "rounded" without softening
 * the element.
 *
 * Below `sm`, the rounding is barely visible at common sizes —
 * `2px` rounds are correct for a checkbox but read as a rendering
 * artefact on a card. `sm` is the smallest value a card-shaped
 * surface should use.
 */
export const radius_sm: RadiusValue = 4;

/**
 * `radius.md` — 8px.
 *
 * Standard controls. Buttons, inputs, chips, the everyday
 * interactive surface. The most-used step in the scale; if a
 * design has more `md` than any other radius, that is the design
 * speaking.
 *
 * 8px parallels `space.md` (16) at half — a button padded by
 * `space.md` with `radius.md` reads as visually balanced. The
 * audit script uses `radius.md` as the "is this a standard
 * control" gate.
 */
export const radius_md: RadiusValue = 8;

/**
 * `radius.lg` — 12px.
 *
 * Larger cards, panels, surfaces that lift off the page. A
 * settings card, a list row that sits in a card container, a
 * settings sheet.
 *
 * This is the smallest value that reads as a *panel* — smaller
 * than `lg` reads as a button, larger reads as a hero surface.
 * The audit script uses `lg` as the lower bound for "panel
 * spacing".
 */
export const radius_lg: RadiusValue = 12;

/**
 * `radius.xl` — 16px.
 *
 * Hero panels, modal sheets. The corner that says "this is a
 * presentation surface, not a control".
 *
 * A card that uses `xl` is making a deliberate softness choice;
 * `xl` is too soft for an interactive control and too small for
 * a stage-level surface. The audit flags a button using `xl` —
 * the value is right for what the button is doing wrong.
 */
export const radius_xl: RadiusValue = 16;

/**
 * `radius.2xl` — 24px.
 *
 * The largest visible shape on a screen. A stage-level surface
 * — a hero panel, a finished-state celebration, the corner of
 * a container that fills the screen.
 *
 * Should not appear on small interactive controls. The audit
 * flags `2xl` on a button-sized surface, because the rounding
 * exceeds the height and the button reads as a stadium.
 */
export const radius_2xl: RadiusValue = 24;

/**
 * `radius.full` — 9999.
 *
 * A circle (an avatar, a status dot), a pill (a button whose
 * borderRadius exceeds `height / 2`). The deliberate pill.
 *
 * 9999 is large enough that an element whose smaller dimension
 * is below 9999 renders as a perfect pill (the engine clamps to
 * half the smaller side). A future platform adapter may swap
 * 9999 → `50%` on web and → `9999` on native without changing
 * the token name; consumers read `radius.full`, adapters decide
 * what 9999 means in their engine.
 *
 * The `as const` on `radius.full = 9999` is the same as the
 * other leaves — the value is a number, the type is `RadiusValue`,
 * and the engine-level choice is downstream.
 */
export const radius_full: RadiusValue = 9999;

/* ============================================================================
 * Assembled scale
 * ========================================================================== */

/**
 * The radius scale as a single readonly object.
 *
 * Keys are the {@link RadiusStep} union, values are the leaves
 * above. The shape `Readonly<Record<RadiusStep, RadiusValue>>`
 * is a contract:
 *
 *   - Every step in {@link RadiusStep} must have a value here. A
 *     missing key is a TS error.
 *   - The values cannot be reassigned at the object level (the
 *     `Readonly<…>` wrapper prevents that), and the leaves
 *     themselves are `const`s so even a `Readonly<…>` wrapper
 *     does not help — there is no mutation path.
 *   - Adding a new step is one line in {@link RadiusStep} and
 *     one line in this object. The TS error message names both
 *     locations.
 *
 * Consumers read this object via the `radius.*` path a future
 * `useTheme()` hook will expose (`theme.radius.lg`). For tests
 * and direct access today, the object is also exported from
 * `tokens/index.ts` as the `radius` named export.
 */
export const radius: Readonly<Record<RadiusStep, RadiusValue>> =
  Object.freeze({
    none: radius_none,
    sm: radius_sm,
    md: radius_md,
    lg: radius_lg,
    xl: radius_xl,
    '2xl': radius_2xl,
    full: radius_full,
  });

/**
 * The {@link RadiusStep} union re-exported under the conventional
 * `Radius` name.
 *
 * Some consumers want to type a prop as "any radius step" — for
 * example, a generic container's `corner` prop. `Radius` is the
 * type for that: `function Container({ corner }: { corner: Radius })`.
 *
 * `RadiusStep` and `Radius` are aliases today; the alias is kept
 * so that the type has a name consumers recognise. If a future
 * phase needs to distinguish "any radius step" from "the named
 * step", split them — until then, the alias is enough.
 */
export type Radius = RadiusStep;

/**
 * The full radius scale — a `Readonly<Record<RadiusStep, number>>`.
 * Distinct from {@link Radius}, which is the *step-name union*
 * (the right type for a consumer prop like `<Card corner={…}>`).
 * The Theme assembly and future role-composition consumers want
 * this `Record` view: `theme.radius.md` reads as a `number`.
 */
export type RadiusScale = Readonly<Record<RadiusStep, number>>;