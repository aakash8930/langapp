/**
 * Spacing scale.
 *
 * One scale, eleven steps, all in CSS pixels. The scale is a 4-point
 * grid with two half-steps below the base (`3xs`, `2xs`) and a small
 * ladder above (`xs` through `5xl`).
 *
 * Why this many steps:
 *   - Eight values is the wrong number. An 8-step scale *looks*
 *     symmetrical but no design uses exactly eight — every design
 *     picks the steps that have semantic meaning, and pretending
 *     the values are mechanical is a lie the scale eventually tells.
 *   - Eleven named steps is enough room that every gap the two
 *     existing surfaces of the product use today (and the gaps Phase 2
 *     will add) has a home. The escape hatch is `5xl`, and using it
 *     is rare enough that someone notices.
 *
 * Why T-shirt sizes and not numbers:
 *   - Numbers become meaningless when the underlying base changes
 *     (a future 6-pt scale or 8-pt scale breaks `space.8`).
 *   - T-shirts stay human-meaningful through a rename. `space.md`
 *     is still `space.md` whether the base is 4, 5, or 8.
 *
 * What spacing tokens are NOT:
 *   - Component-specific. There is no `buttonPadding`, no
 *     `cardGap`, no `modalPadding`. Components compose spacing
 *     tokens at the call site. A button's padding is
 *     `space.sm` horizontally and `space.md` vertically; that
 *     binding is the *Button's*, not a token.
 *   - Negative. A `space.negative` role would be a smell —
 *     components that need to break out of normal flow pull an
 *     edge of the screen rather than reading a negative token.
 *   - Typography. Letter-spacing, line-height, paragraph rhythm
 *     live in the typography tokens, not here.
 *
 * Tree-shaking:
 *   Every leaf is its own `export const`. A consumer that imports
 *   only `space_md` does not pull `space_5xl` at runtime; a bundler
 *   with `sideEffects: false` (Phase 2.3+) drops the unused leaves
 *   from the output bundle entirely.
 *
 * Immutability:
 *   Every leaf is a `const`. The assembled object is `Object.freeze`'d
 *   so a consumer cannot mutate the spacing scale at runtime — `as
 *   const` alone would catch a *compile-time* mutation but not a
 *   runtime write like `space.md = 17`. Two layers, by intent.
 *
 * Type discipline:
 *   The shape below is the contract for the spacing scale. Adding
 *   a step is one line here, one line in the assembled object, and
 *   one line in `tokens/index.ts` for the leaf re-export. Forgetting
 *   any of the three is a TS error.
 */

/**
 * The eleven steps of the spacing scale, in ascending order.
 *
 * Names are T-shirt sized: `3xs` is the smallest, `5xl` is the
 * largest. The ordering matters for the `Readonly<Record<…, number>>`
 * shape below — TS preserves declaration order, which keeps the
 * shape human-readable in IDE tooltips.
 *
 * Future steps (if ever needed) follow the same pattern:
 * `6xl`, `7xl`, and so on. The naming convention outlives the scale.
 */
export type SpacingStep =
  | '3xs'
  | '2xs'
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | '2xl'
  | '3xl'
  | '4xl'
  | '5xl';

/**
 * A single spacing value, in CSS pixels.
 *
 * The type is `number`, not `string`. Both consumers in scope
 * (React Native and Vite-built web) treat a numeric length as
 * the canonical form. A future consumer that needs a unit other
 * than `px` composes at the call site — the spacing token is a
 * magnitude, not a unit-bearing string.
 */
export type SpacingValue = number;

/* ============================================================================
 * Leaves — one `export const` per step.
 *
 * Every leaf is its own export so consumers can deep-import a single
 * value (e.g. `import { space_md } from '@genko/design/tokens/spacing'`)
 * without pulling the rest of the scale. The aliases in
 * `tokens/index.ts` give every leaf a `spaceMd` PascalCase name too.
 * ========================================================================== */

/**
 * `space.3xs` — 2px.
 *
 * Sub-pixel alignment. The gap between an inline icon and its label,
 * the distance between two stacked checkbox squares. **Often too
 * small for non-icon neighbours** — present, but a consumer should
 * reach for `2xs` or `xs` when two text siblings need to sit apart.
 *
 * The audit script (Phase 2.1 §11) flags `3xs` used in margins; it
 * is for inline alignment, not page rhythm.
 */
export const space_3xs: SpacingValue = 2;

/**
 * `space.2xs` — 4px.
 *
 * The base unit of the scale. Half of `xs`. Used where `xs` (8px) is
 * too coarse — a tight vertical stack inside a chip, a gap between
 * two adjacent badges.
 *
 * This is also the smallest step that should appear in a margin.
 * Anything smaller belongs to inline alignment.
 */
export const space_2xs: SpacingValue = 4;

/**
 * `space.xs` — 8px.
 *
 * Tiny inline gaps: a row of two pills, a checkbox label sitting
 * beside its square. The most common "almost-no-space" value.
 */
export const space_xs: SpacingValue = 8;

/**
 * `space.sm` — 12px.
 *
 * Small intra-component gaps. The vertical padding between an
 * input's label and the input itself; the gap between a row's
 * icon and its label inside a chip.
 *
 * The padding inside a control — `space.sm` horizontally, `space.md`
 * vertically — is a *binding*, not a token rule, but it is
 * consistent enough across buttons, inputs, and chips that
 * component code reaches for this exact value most often.
 */
export const space_sm: SpacingValue = 12;

/**
 * `space.md` — 16px.
 *
 * Default vertical gap between sibling paragraphs and cards. The
 * most-used step in the scale; if a design has more `md` than any
 * other step, that is the design speaking.
 *
 * 16px is also the smallest interactive-text padding bound:
 * a touch target on mobile clears 44pt, and `md` is the smallest
 * value that reliably contributes to that target when used in a
 * vertical stack.
 */
export const space_md: SpacingValue = 16;

/**
 * `space.lg` — 24px.
 *
 * Between sections within a screen. A heading above its body, a
 * primary action below a paragraph of supporting copy.
 *
 * This is the smallest value that reads as a *section break* —
 * smaller than `lg` reads as continuation, larger reads as a
 * deliberate gap. The audit script uses `lg` as the lower bound
 * for "section spacing."
 */
export const space_lg: SpacingValue = 24;

/**
 * `space.xl` — 32px.
 *
 * Between major regions. Header to body, body to footer. The gap
 * a screen reader announces as a navigation landmark.
 *
 * Above `xl`, the values read as "page-level" — and a screen that
 * uses `xl` for two adjacent elements is making a page-level
 * choice on each of them, which is usually right.
 */
export const space_xl: SpacingValue = 32;

/**
 * `space.2xl` — 48px.
 *
 * Page-level gaps. A hero to its first section, a finished
 * milestone to the next CTA. The smallest value that reads as
 * "this is a different region" rather than "this is space within
 * the same region."
 *
 * 48px is also the standard iOS / Material touch-target size.
 * A button that uses `2xl` for its vertical padding clears the
 * touch-target minimum without further padding.
 */
export const space_2xl: SpacingValue = 48;

/**
 * `space.3xl` — 64px.
 *
 * Hero-scale gaps. The space between a hero panel and the
 * curriculum that follows it; the breathing room around a
 * large display figure.
 *
 * Should not appear horizontal on small screens — the audit
 * flags `3xl` used as left/right margin on a phone-width
 * viewport, because it crowds content into the centre and
 * forces overflow on small devices.
 */
export const space_3xl: SpacingValue = 64;

/**
 * `space.4xl` — 96px.
 *
 * Section breaks. The gap that says "we have changed subjects."
 * Used as a `padding-block` on a full-screen container, never as
 * a gap between sibling rows of the same content.
 */
export const space_4xl: SpacingValue = 96;

/**
 * `space.5xl` — 128px.
 *
 * Top-of-page separation. The `margin-block` on a hero or a
 * finished-state screen — the largest value in the scale, used
 * once per screen, used deliberately.
 *
 * The escape hatch: every value above `xl` should appear in a
 * screen exactly once or twice. A screen that uses `5xl` three
 * times is treating `5xl` as a normal value, which it isn't —
 * the audit warns when a single screen reads `5xl` more than
 * three times.
 */
export const space_5xl: SpacingValue = 128;

/* ============================================================================
 * Assembled scale
 * ========================================================================== */

/**
 * The spacing scale as a single readonly object.
 *
 * Keys are the {@link SpacingStep} union, values are the leaves
 * above. The shape `Readonly<Record<SpacingStep, SpacingValue>>`
 * is a contract:
 *
 *   - Every step in {@link SpacingStep} must have a value here. A
 *     missing key is a TS error.
 *   - The values cannot be reassigned at the object level (the
 *     `Readonly<…>` wrapper prevents that), and the leaves
 *     themselves are `const`s so even a `Readonly<…>` wrapper
 *     does not help — there is no mutation path.
 *   - Adding a new step is one line in {@link SpacingStep} and
 *     one line in this object. The TS error message names both
 *     locations.
 *
 * Consumers read this object via the `space.*` path a future
 * `useTheme()` hook will expose (`theme.spacing.md`). For tests
 * and direct access today, the object is also exported from
 * `tokens/index.ts` as the `space` named export.
 */
export const space: Readonly<Record<SpacingStep, SpacingValue>> =
  Object.freeze({
    '3xs': space_3xs,
    '2xs': space_2xs,
    xs: space_xs,
    sm: space_sm,
    md: space_md,
    lg: space_lg,
    xl: space_xl,
    '2xl': space_2xl,
    '3xl': space_3xl,
    '4xl': space_4xl,
    '5xl': space_5xl,
  });

/**
 * The {@link SpacingStep} union re-exported under the conventional
 * `Spacing` name.
 *
 * Some consumers want to type a prop as "any spacing step" — for
 * example, a `<Stack>` component's `gap` prop. `Spacing` is the
 * type for that: `function Stack({ gap }: { gap: Spacing })`.
 *
 * `SpacingStep` and `Spacing` are aliases today; the alias is
 * kept so that the type has a name consumers recognise. If a
 * future phase needs to distinguish "any spacing step" from "the
 * named step", split them — until then, the alias is enough.
 */
export type Spacing = SpacingStep;

/**
 * The full spacing scale — a `Readonly<Record<SpacingStep, number>>`.
 * Distinct from {@link Spacing}, which is the *step-name union*
 * (the right type for a consumer prop like `<Stack gap={…}>`).
 * The Theme assembly and future role-composition consumers want
 * this `Record` view: `theme.spacing.md` reads as a `number`.
 */
export type SpacingScale = Readonly<Record<SpacingStep, number>>;
