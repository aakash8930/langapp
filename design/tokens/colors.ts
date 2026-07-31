/**
 * Color token contracts.
 *
 * This file declares the SHAPE of the colour token system. It is intentionally
 * value-free: the names and structure live here, the values live in
 * `light.ts` and `dark.ts`.
 *
 * Why a contracts-only file:
 *   1. Adding a new role is a one-line edit to this file and a matching entry
 *      in each palette file. Without a contracts file, the shape is implicit
 *      and additions drift.
 *   2. The shapes below match the Phase 2.2 token taxonomy. A role that does
 *      not appear here cannot be referenced from a consumer.
 *   3. This file imports nothing from the rest of the package and exports
 *      nothing but types and `const`-typed structural aliases, so consumers
 *      that import only the *contracts* (e.g. a future typings-only
 *      consumer) pay nothing at runtime.
 *
 * Re-exports: none. Definitions: contract types only. Runtime behaviour:
 * none.
 */

/**
 * The hue categories a colour token can fall into.
 *
 * Not a token value — this is the *content* of a colour, not its name.
 * Consumers rarely care about this; it exists so the contrast engine and
 * tooling can reason about a token without parsing its role.
 */
export type ColorHue =
  | 'neutral'
  | 'brand'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

/**
 * A single colour value.
 *
 * The brief is implementation-agnostic at this layer: a token *value* is
 * whatever the platform adapter can render. Today both surfaces in scope
 * render hex strings; a future surface may render an object
 * (`{ r, g, b, a }`) without this type changing. For that reason, the
 * exposed value type is a string — the format the consumers and contrast
 * engine currently use — and the format-check lives at the build step,
 * not here.
 */
export type ColorValue = string;

/* ============================================================================
 * Group: bg (surfaces an element sits on)
 * ========================================================================== */

/** Page ground behind everything else. */
export const bg_app = 'bg.app';
/** Default resting surface (a card, a sheet, a menu). */
export const bg_surface = 'bg.surface';
/** One layer above {@link bg_surface} (a tooltip, a popover menu). */
export const bg_surfaceElevated = 'bg.surfaceElevated';
/** A deliberately recessed surface (an inset code block, an unfilled input slot). */
export const bg_surfaceMuted = 'bg.surfaceMuted';

/* ============================================================================
 * Group: fg (text drawn on a bg.* surface)
 * ========================================================================== */

/** Body text on {@link bg_surface}. */
export const fg_textPrimary = 'fg.textPrimary';
/** Subordinate text on the same surface. */
export const fg_textSecondary = 'fg.textSecondary';
/** Caption text — quieter still. */
export const fg_textMuted = 'fg.textMuted';
/** Text drawn on a high-contrast surface (`bg.surfaceInverse` in the Phase 2.2 spec). */
export const fg_textInverse = 'fg.textInverse';

/* ============================================================================
 * Group: border (edges, dividers, focus rings)
 *
 * The brief's three names — `border`, `borderStrong`, `borderFocus` —
 * resolve to the Phase 2.2 `border.*` family entry most often used in
 * each role. The Phase 2.2 contract adds `border.subtle` etc. as a future
 * extension point; the brief keeps the surface area to three.
 * ========================================================================== */

/**
 * The `path_` prefix on each constant below is the contract for
 * role-name string sentinels. These are the *string* values that
 * {@link ColorTokenName} accepts — `'border'`, `'border.strong'`,
 * `'border.focus'` — not the colour values themselves (those live
 * as `Palette['border']['border']` in `light.ts` / `dark.ts`).
 *
 * The prefix frees the bare identifier `border` for the
 * border-level metadata scale in `borders.ts`, where `border` is
 * the assembled record of all five semantic levels. The colour
 * subsystem's public surface (`Palette`, `lightPalette`,
 * `darkPalette`) is unaffected — the prefix is internal to the
 * colour subsystem's type contracts.
 */

/** The role-name string for the resting edge — a hairline divider, the default input border. */
export const path_border = 'border';
/** The role-name string for a definite boundary — an unfocused input's contrast against the page, a modal edge. */
export const path_borderStrong = 'border.strong';
/** The role-name string for a focus ring colour. Always brand-tinted so it is visible on every surface. */
export const path_borderFocus = 'border.focus';

/* ============================================================================
 * Group: accent (the single brand interaction colour)
 *
 * Per Phase 2.2: `accent.default` is the resting state; `accent.hover` and
 * `accent.pressed` are interactive states. The brief asks for the flat
 * name `accent`; we expose that as the resting role and keep room for the
 * state-pair siblings in the same group as the consumer adds them. Adding
 * them later is one line here and one entry per palette.
 * ========================================================================== */

/** Resting accent — the brand action colour. */
export const accent = 'accent';
/**
 * Hover state — one step toward higher contrast on a light ground, one
 * step toward lower on dark. Paired with {@link accent}.
 */
export const accentHover = 'accent.hover';
/** Pressed state — paired with {@link accent}. */
export const accentPressed = 'accent.pressed';

/* ============================================================================
 * Group: feedback (success / warning / danger / info families)
 *
 * Each family carries three values: the surface fill, the foreground that
 * draws on it (an icon, a heading), and the edge of the surface. The
 * `textOn.*` companion (foreground text reading on the surface) is
 * documented in Phase 2.2 §4.2 and will land here as a follow-up; the
 * brief limits this phase to `fg + bg + border` per state.
 * ========================================================================== */

/**
 * A positive outcome — a successful completion, a "passed" state.
 *
 * Each entry is the role *name*. Values are provided by `light.ts` and
 * `dark.ts`.
 */
export const success_bg = 'feedback.success.bg';
export const success_fg = 'feedback.success.fg';
export const success_border = 'feedback.success.border';

/**
 * Cautionary state — requires attention but not action.
 *
 * Each entry is the role *name*. Values are provided by `light.ts` and
 * `dark.ts`.
 */
export const warning_bg = 'feedback.warning.bg';
export const warning_fg = 'feedback.warning.fg';
export const warning_border = 'feedback.warning.border';

/**
 * Destructive state — an errored input, a destructive action.
 *
 * Each entry is the role *name*. Values are provided by `light.ts` and
 * `dark.ts`.
 */
export const danger_bg = 'feedback.danger.bg';
export const danger_fg = 'feedback.danger.fg';
export const danger_border = 'feedback.danger.border';

/**
 * Neutral informative state.
 *
 * Each entry is the role *name*. Values are provided by `light.ts` and
 * `dark.ts`.
 */
export const info_bg = 'feedback.info.bg';
export const info_fg = 'feedback.info.fg';
export const info_border = 'feedback.info.border';

/* ============================================================================
 * Group: overlay (modal scrim, backdrop dim)
 *
 * Phase 2.2 splits `overlay.scrim` (modal), `overlay.menuScrim`, and
 * `overlay.tooltipScrim` as separate roles because a modal scrim and a
 * menu scrim are visually different. The brief asks for the flat name
 * `overlay`; we expose it as the modal scrim and leave the lighter
 * variants as future additions in the same family.
 * ========================================================================== */

/** The dimming layer behind a modal dialog. */
export const overlay = 'overlay';

/* ============================================================================
 * Group: disabled (the disabled state — surfaces, foregrounds, borders)
 *
 * The disabled state is a *read-only view* of the existing surface, text,
 * and border families. Per Phase 2.2, three roles together express the
 * disabled state: `disabled.bg` (the surface), `disabled.fg` (the text),
 * and Phase 2.2 §4.2's paired `border.disabled` (the edge). The brief
 * asks for the family name `disabled`; we expose the two most-used
 * roles (`bg` and `fg`) here and keep the third as a follow-up.
 * ========================================================================== */

/** Background of a disabled surface — paired with {@link disabled_fg}. */
export const disabled_bg = 'disabled.bg';
/** Foreground text on a disabled surface — paired with {@link disabled_bg}. */
export const disabled_fg = 'disabled.fg';

/* ============================================================================
 * Type-level shape of a fully-resolved palette
 *
 * The shape below is the *contract for a palette's value side*. A palette
 * that fails to provide any field of this shape is a TS error at build
 * time. Adding a new role requires editing this type — that is the gate,
 * not the convention.
 * ========================================================================== */

/**
 * The `bg` group of a palette. Add a new role here once a palette
 * provides a value for it, never before.
 */
export type BgGroup = {
  readonly app: ColorValue;
  readonly surface: ColorValue;
  readonly surfaceElevated: ColorValue;
  readonly surfaceMuted: ColorValue;
};

/**
 * The `fg` group of a palette.
 */
export type FgGroup = {
  readonly textPrimary: ColorValue;
  readonly textSecondary: ColorValue;
  readonly textMuted: ColorValue;
  readonly textInverse: ColorValue;
};

/**
 * The `border` group of a palette, in the brief's reduced form
 * (three names). Phase 2.2's wider family — `border.subtle`,
 * `border.feedback.*`, etc. — is reserved for a future phase.
 */
export type BorderGroup = {
  readonly border: ColorValue;
  readonly borderStrong: ColorValue;
  readonly borderFocus: ColorValue;
};

/**
 * The `accent` group of a palette in the brief's reduced form.
 *
 * `hover` and `pressed` are exported (the contracts above) but defined
 * here so a palette must provide both when it provides `accent`. A
 * later phase that wants to add `accent.subtle` will extend this type.
 */
export type AccentGroup = {
  readonly accent: ColorValue;
  readonly accentHover: ColorValue;
  readonly accentPressed: ColorValue;
};

/**
 * One feedback family in `bg / fg / border` form. Used by all four
 * families (`success`, `warning`, `danger`, `info`).
 */
export type FeedbackFamily = {
  readonly bg: ColorValue;
  readonly fg: ColorValue;
  readonly border: ColorValue;
};

/**
 * The `feedback` group of a palette — four families, each in
 * {@link FeedbackFamily} shape.
 */
export type FeedbackGroup = {
  readonly success: FeedbackFamily;
  readonly warning: FeedbackFamily;
  readonly danger: FeedbackFamily;
  readonly info: FeedbackFamily;
};

/**
 * The `overlay` group of a palette.
 */
export type OverlayGroup = {
  readonly overlay: ColorValue;
};

/**
 * The `disabled` group of a palette, brief form (`bg` + `fg`).
 */
export type DisabledGroup = {
  readonly disabled_bg: ColorValue;
  readonly disabled_fg: ColorValue;
};

/**
 * The full shape of a palette value.
 *
 * Every palette (`light.ts`, `dark.ts`, future `premium.ts`, etc.) must
 * produce a value of this type. Missing fields are TS errors; extra
 * fields are TS errors. The shape is the contract.
 */
export type Palette = {
  readonly bg: BgGroup;
  readonly fg: FgGroup;
  readonly border: BorderGroup;
  readonly accent: AccentGroup;
  readonly feedback: FeedbackGroup;
  readonly overlay: OverlayGroup;
  readonly disabled: DisabledGroup;
};

/**
 * The schemes a palette may serve. Frozen by intent — Phase 2.2 §4.3
 * forbids theme-specific tokens, and the only schemes in scope today
 * are `light` and `dark`.
 */
export type ColorScheme = 'light' | 'dark';

/**
 * A record that pairs a {@link ColorScheme} with the palette shape
 * above. The shape used by Phase 2.3's `buildTheme(…)` (which is *not*
 * part of this phase) — included here so the contract is complete even
 * though the assembly function lands later.
 */
export type PaletteByScheme = {
  readonly [scheme in ColorScheme]: Palette;
};

/**
 * A single role *name* — the union of every name exported above.
 *
 * `ColorTokenName` is the TS-level way of saying "this string IS one of
 * the role names above." A future `theme.get(token: ColorTokenName)`
 * helper will use this — included here so the type lands with the
 * contracts, before its only consumer does.
 */
export type ColorTokenName =
  | typeof bg_app
  | typeof bg_surface
  | typeof bg_surfaceElevated
  | typeof bg_surfaceMuted
  | typeof fg_textPrimary
  | typeof fg_textSecondary
  | typeof fg_textMuted
  | typeof fg_textInverse
  | typeof path_border
  | typeof path_borderStrong
  | typeof path_borderFocus
  | typeof accent
  | typeof accentHover
  | typeof accentPressed
  | typeof success_bg
  | typeof success_fg
  | typeof success_border
  | typeof warning_bg
  | typeof warning_fg
  | typeof warning_border
  | typeof danger_bg
  | typeof danger_fg
  | typeof danger_border
  | typeof info_bg
  | typeof info_fg
  | typeof info_border
  | typeof overlay
  | typeof disabled_bg
  | typeof disabled_fg;
