/**
 * Border scale.
 *
 * Five semantic levels (`none`, `subtle`, `default`, `strong`,
 * `focus`) and the metadata each level carries. The scale
 * answers a single design question: **how visually prominent is
 * the edge of this element?**
 *
 * Why this scale has no rendering values (yet):
 *   Borders are the second metadata-only subsystem (after
 *   elevation). A complete border is `(width, style, colour)`
 *   — and all three are owned by other systems:
 *
 *     - The width is a width-token concern (Phase 2.2
 *       documented `border.width.hairline`, `border.width.thick`,
 *       `border.width.thicker`).
 *     - The style (solid, dashed, dotted) is also a width-token
 *       concern.
 *     - The colour is a colour-token concern — `colors.ts`
 *       already exposes `border.subtle`, `border.default`,
 *       `border.strong`, `border.focus` as semantic colour roles.
 *
 *   What this subsystem owns is the **emphasis level** of the
 *   border: `none`, `subtle`, `default`, `strong`, `focus`. A
 *   future platform adapter composes the level with the width
 *   and colour to produce a real rendered border. The level is
 *   the choice a designer makes; the adapter is what turns
 *   that choice into a CSS `border` shorthand or a React Native
 *   `{ borderWidth, borderColor, borderStyle }` tuple.
 *
 * Why `focus` is its own border level:
 *   A keyboard focus indicator is a border on every platform —
 *   a `border` on web and Android, an outline on iOS that
 *   follows the same shape. Folding focus into the colour
 *   subsystem (`border.focus` already exists there) misses that
 *   the *role* of the border is focus, not "an accent-coloured
 *   border at default emphasis". Putting `focus` in this scale
 *   lets a component today read `<Input border="focus" />` and
 *   the prop carries semantic intent the adapter can read
 *   directly.
 *
 * What borders are NOT:
 *   - Theme-dependent. The level of a border is the same in
 *     light and dark mode; only the *colour* changes, and that
 *     is the colour subsystem's job.
 *   - A replacement for elevation. A flat card with a `default`
 *     border and a card with `elevation.sm` are different
 *     design choices. The two are sometimes interchangeable —
 *     a card can have either, not both — and the audit script
 *     catches an element with both.
 *   - Decorative web noise. `border-style: double`, `groove`,
 *     and `ridge` are not in this scale. The three styles the
 *     design actually uses (`solid`, `dashed`, `dotted`) belong
 *     to the width-token system Phase 2.2 documented.
 *
 * Tree-shaking:
 *   Every level is its own `export const`. A consumer that
 *   imports only `border_default` does not pull `border_focus`
 *   at runtime; a bundler with `sideEffects: false`
 *   (Phase 2.3+) drops the unused levels from the output
 *   bundle.
 *
 * Immutability:
 *   The metadata objects are frozen; the assembled `border`
 *   record is `Object.freeze`'d at construction. Two layers,
 *   by the same reasoning as the other metadata subsystems.
 */

/**
 * The five semantic border levels, in ascending order of visual
 * emphasis.
 *
 * `none` is first because flat means *no* border, and that is
 * the most common state in a content-heavy design. `focus` is
 * deliberately last because a focus indicator is its own role —
 * not "the strongest border", but "the border that means focus".
 * A `strong` border that is *not* a focus indicator is a
 * different decision from a `focus` border.
 */
export type BorderLevel =
  | 'none'
  | 'subtle'
  | 'default'
  | 'strong'
  | 'focus';

/**
 * The visual-emphasis weight of a border level. The
 * {@link BorderLevelMeta.weight} field uses this union so a
 * future platform adapter can `switch (border.weight)` to pick
 * the right border-width-from-the-widths-token-category.
 *
 * Four values:
 *   - `'none'` — the absence of a border. The level renders
 *     `border: 0` (or the platform's no-render equivalent).
 *   - `'low'` — `subtle`. Hairline, low-emphasis.
 *   - `'standard'` — `default`. Standard outlines.
 *   - `'high'` — `strong`. A definite edge.
 *   - `'accessibility'` — `focus`. A focus indicator.
 *
 * `accessibility` is a deliberate stand-alone weight, not just
 * "high + special colour", so adapters and audit scripts can
 * branch on it specifically.
 */
export type BorderWeight =
  | 'none'
  | 'low'
  | 'standard'
  | 'high'
  | 'accessibility';

/**
 * The metadata a single border level carries.
 *
 * Four fields, all required:
 *   - `level` is the same {@link BorderLevel} literal the
 *     consumer passed in. Recorded on the metadata so a future
 *     adapter that receives the whole record can recover the
 *     input without rebuilding the lookup.
 *   - `description` is the one-sentence "use for" sentence the
 *     design system uses when a contributor asks what the
 *     level is for. The audit script surfaces this in error
 *     messages when a level is misused.
 *   - `weight` is the {@link BorderWeight} classification — the
 *     emphasis the level carries. The platform adapter uses
 *     this field to pick the right border-width token.
 *   - `hint` is an optional orientation note for the adapter
 *     ("the border is part of the affordance", "the border
 *     tracks keyboard navigation"). The hint is the designer's
 *     prose, not the engine's choice.
 */
export interface BorderLevelMeta {
  readonly level: BorderLevel;
  readonly description: string;
  readonly weight: BorderWeight;
  readonly hint?: string;
}

/* ============================================================================
 * Leaves — one `export const` per level.
 *
 * Every level is its own export so consumers can deep-import a
 * single entry (e.g. `import { border_default } from
 * '@genko/design/tokens/borders'`) without pulling the rest.
 * The aliases in `tokens/index.ts` give every leaf a
 * `borderDefault` PascalCase name too.
 * ========================================================================== */

/**
 * `border.none` — no visible border.
 *
 * The deliberate absence of an edge. The element relies on
 * background colour or whitespace alone to read as a unit.
 *
 * Adapter contract: render no border (`border: 0`, or remove
 * the border property entirely on platforms that render one
 * by default). The element may still have an elevation; the
 * two are independent decisions and a single element should
 * not have `border.none` *and* `elevation.md` simultaneously
 * — choose one. The audit script catches that overlap.
 */
export const border_none: BorderLevelMeta = Object.freeze({
  level: 'none',
  weight: 'none',
  description: 'No visible border. The element reads without an edge.',
});

/**
 * `border.subtle` — low-emphasis separators.
 *
 * A hairline. The divider between two list rows, the edge of
 * an inset code block, the line between a card and its page.
 *
 * Adapter contract: a 1px line in the lowest-emphasis border
 * colour the palette provides. The hairline is the only
 * permitted separation device — Phase 2.1 §13 calls this out
 * as the "boring obvious" rule the design system inherits
 * from web/CLAUDE.md and client/CLAUDE.md.
 */
export const border_subtle: BorderLevelMeta = Object.freeze({
  level: 'subtle',
  weight: 'low',
  description: 'Low-emphasis separators. A hairline, a divider, the edge of an inset.',
  hint: '1px, low-emphasis colour. The hairline.',
});

/**
 * `border.default` — standard component outlines.
 *
 * The edge of an input, the outline of a card on the page, the
 * boundary of a sheet. The default border that says "this is a
 * thing" without committing to "this is a strong thing".
 *
 * Adapter contract: a 1px (or platform-default width) line in
 * the standard border colour. A consumer that wants a
 * higher-emphasis outline reaches for `strong`.
 */
export const border_default: BorderLevelMeta = Object.freeze({
  level: 'default',
  weight: 'standard',
  description: 'Standard component outlines. An input, a card, a sheet.',
  hint: '1px, standard colour. The default outline.',
});

/**
 * `border.strong` — high-emphasis outlines.
 *
 * A definite boundary. An unfocused input that wants a visible
 * edge, a modal outline, the border around a featured card.
 * Reads as a deliberate drawing decision, not a default.
 *
 * Adapter contract: a thicker line in the strong border
 * colour. A consumer that uses `strong` should have a reason
 * — a screen covered in `strong` borders reads as busy. The
 * audit script catches more than two `strong` borders in a
 * single screen.
 */
export const border_strong: BorderLevelMeta = Object.freeze({
  level: 'strong',
  weight: 'high',
  description: 'High-emphasis outlines. A modal edge, a featured card, a deliberate boundary.',
  hint: 'Thicker line in strong colour. A deliberate drawing decision.',
});

/**
 * `border.focus` — accessibility and keyboard focus
 * indicators.
 *
 * The visible ring around the element that has keyboard focus.
 * A web `outline`, an Android focus ring, an iOS focus
 * indicator — every platform has a focus indicator, and on
 * every platform it is the border system's job to draw it.
 *
 * Adapter contract: a brand-coloured ring that meets contrast
 * against every surface it can land on. The colour is the
 * `border.focus` role from the colour subsystem (`colors.ts`);
 * the width is the accessibility-width token from the
 * width-token category. The level is `focus`, not
 * `strong + special colour`, so adapters and audit scripts can
 * branch on the role directly.
 *
 * Reduced-motion / `prefers-contrast`: the focus indicator is
 * never an animation and never fades — it is drawn or it is
 * not. Accessibility is binary, not graceful-degradation.
 */
export const border_focus: BorderLevelMeta = Object.freeze({
  level: 'focus',
  weight: 'accessibility',
  description: 'Accessibility and keyboard focus indicators.',
  hint: 'Brand-coloured ring at accessibility width. Never fades, never animates.',
});

/* ============================================================================
 * Assembled scale
 * ========================================================================== */

/**
 * The border scale as a single readonly object.
 *
 * Keys are the {@link BorderLevel} union; values are the
 * metadata records the leaves above expose. The shape
 * `Readonly<Record<BorderLevel, BorderLevelMeta>>` is a
 * contract:
 *
 *   - Every level in {@link BorderLevel} must have a value
 *     here. A missing key is a TS error.
 *   - The values cannot be reassigned at the object level (the
 *     `Readonly<…>` wrapper prevents that), and the leaves are
 *     frozen with `Object.freeze` so a runtime write like
 *     `border.default = { ... }` throws or silently fails.
 *   - Adding a new level is one line in {@link BorderLevel},
 *     one frozen const above, and one entry in this object.
 *     Forgetting any of the three is a TS error.
 *
 * Consumers read this object via the `border.*` path a future
 * `useTheme()` hook will expose (`theme.border.default`). For
 * tests and direct access today, the object is also exported
 * from `tokens/index.ts` as the `border` named export.
 */
export const border: Readonly<Record<BorderLevel, BorderLevelMeta>> =
  Object.freeze({
    none: border_none,
    subtle: border_subtle,
    default: border_default,
    strong: border_strong,
    focus: border_focus,
  });

/**
 * The {@link BorderLevel} union is **not** aliased to `Border`
 * the way `Spacing` aliased `SpacingStep` and `Radius` aliased
 * `RadiusStep`.
 *
 * The reason: `border` is already a CSS shorthand string and a
 * React Native style key. A future prop named `border: Border`
 * would shadow both at the call site, and the shadowing would
 * silently change meaning. The longer name — and the
 * `border_*` leaf prefix — keeps the collision in mind for
 * the component phase.
 *
 * Consumers that want to type a prop as "any border level"
 * write it as `border: BorderLevel`. If a future phase adds a
 * value-vs-level split (the level name vs a typed metadata
 * record), it lands as a second type, not an alias.
 */