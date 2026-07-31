/**
 * Public barrel for the colour token subsystem.
 *
 * Re-exports the contract types from `colors` and the two palette
 * value-objects from `light` and `dark`. Nothing here defines a
 * token — definitions live in the three siblings, kept apart so each
 * can be deep-imported (a bundler can drop `darkPalette` when only
 * `lightPalette` is consumed; verified by the leaf-level `export const`
 * shape in the siblings).
 *
 * Tree-shaking note: this barrel re-exports named symbols only.
 * There is no `export *` and no `export { default as … }` here.
 * A bundler reading this file can resolve each re-export to its
 * origin module and drop unused leaves across the whole package.
 *
 * The package.json `sideEffects: false` flag is a Phase 2.3+ setting
 * on `@genko/design/package.json`. With the flag in place, this file
 * becomes the *only* place a consumer needs to import from — every
 * named export on the package passes through here.
 *
 * Consumers that need a single role for tests can still deep-import:
 *   import { bg_surface } from '@genko/design/tokens/light';
 * The role-name `const`s live in {@link colors} and the leaf values
 * live in the palette files. Both forms are public.
 *
 * ----------------------------------------------------------------------------
 * Spacing (Phase 2.3.2)
 * ----------------------------------------------------------------------------
 *
 * Spacing is the second token subsystem to land. It is structurally
 * simpler than colour — one scale, eleven steps, no theme resolution —
 * so the re-export shape is correspondingly smaller: the assembled
 * `space` object, the per-step leaves, and the `Spacing` / `SpacingStep`
 * type aliases. The same leaf-level deep-import pattern applies:
 *
 *   import { space } from '@genko/design/tokens';
 *   import { space_md } from '@genko/design/tokens/spacing';
 *
 * No `lightSpaceMd` / `darkSpaceMd` aliases exist, because spacing does
 * not theme — the scale is a property of the design, not of the
 * colour scheme.
 *
 * ----------------------------------------------------------------------------
 * Radius (Phase 2.3.3)
 * ----------------------------------------------------------------------------
 *
 * Radius is the third token subsystem to land. Structurally a sibling
 * of spacing — one scale, seven steps, no theme resolution — so the
 * re-export shape mirrors it: the assembled `radius` object, the
 * per-step leaves, and the `Radius` / `RadiusStep` type aliases.
 *
 *   import { radius } from '@genko/design/tokens';
 *   import { radius_md } from '@genko/design/tokens/radius';
 *
 * Like spacing, radius does not theme. A button's corner is 8px in
 * light mode and 8px in dark mode. There are no `lightRadiusMd` /
 * `darkRadiusMd` aliases — only one set of leaves.
 *
 * ----------------------------------------------------------------------------
 * Elevation (Phase 2.3.4)
 * ----------------------------------------------------------------------------
 *
 * Elevation is the fourth token subsystem to land, and the first
 * with **no numeric values**. Six semantic levels (`none`, `xs`,
 * `sm`, `md`, `lg`, `xl`), each carrying a metadata record
 * (level, description, optional hint). The actual shadow math —
 * a web `box-shadow` or a React Native shadow tuple — belongs to
 * a future platform adapter, not to this file.
 *
 *   import { elevation, type ElevationLevel } from '@genko/design/tokens';
 *   import { elevation_md } from '@genko/design/tokens/elevation';
 *
 * Like spacing and radius, elevation does not theme. The level of
 * a card is the same in light mode and dark mode; only the
 * shadow *tint* changes, and that is a colour-token concern
 * (`shadow.*`), not an elevation concern.
 *
 * Note on naming: the union is exported as `ElevationLevel`, not
 * aliased to `Elevation`, because a future prop named
 * `elevation: Elevation` would shadow React Native's native
 * `elevation` prop on `View`. The longer name keeps the
 * collision in mind for the future component work.
 *
 * ----------------------------------------------------------------------------
 * Borders (Phase 2.3.5)
 * ----------------------------------------------------------------------------
 *
 * Borders is the fifth token subsystem to land, and the second
 * metadata-only one (after elevation). Five semantic levels
 * (`none`, `subtle`, `default`, `strong`, `focus`), each
 * carrying a metadata record (level, description, weight,
 * optional hint).
 *
 *   import { border, type BorderLevel } from '@genko/design/tokens';
 *   import { border_default } from '@genko/design/tokens/borders';
 *
 * Like spacing, radius, and elevation, borders do not theme.
 * The level is the same in light and dark mode; only the
 * colour changes, and that is the colour subsystem's job
 * (`colors.ts` already exposes `border.subtle`, `border.default`,
 * `border.strong`, `border.focus` as colour roles).
 *
 * Note on naming: the union is exported as `BorderLevel`, not
 * aliased to `Border`, because `border` is already a CSS
 * shorthand string and a React Native style key. The longer
 * name keeps the collision in mind for the component phase.
 */

// Contract types — the shape of every colour token, never the value.
export type {
  ColorHue,
  ColorValue,
  BgGroup,
  FgGroup,
  BorderGroup,
  AccentGroup,
  FeedbackFamily,
  FeedbackGroup,
  OverlayGroup,
  DisabledGroup,
  Palette,
  ColorScheme,
  PaletteByScheme,
  ColorTokenName,
} from './colors';

// Role-name constants (the `bg.surface` string literals).
export {
  bg_app,
  bg_surface,
  bg_surfaceElevated,
  bg_surfaceMuted,
  fg_textPrimary,
  fg_textSecondary,
  fg_textMuted,
  fg_textInverse,
  path_border,
  path_borderStrong,
  path_borderFocus,
  accent,
  accentHover,
  accentPressed,
  success_bg,
  success_fg,
  success_border,
  warning_bg,
  warning_fg,
  warning_border,
  danger_bg,
  danger_fg,
  danger_border,
  info_bg,
  info_fg,
  info_border,
  overlay,
  disabled_bg,
  disabled_fg,
} from './colors';

// Light palette — values for every role under the `light` scheme.
export { lightPalette } from './light';

// Individual light-palette leaves — exported separately so a consumer
// can `import { bg_app } from '@genko/design/tokens/light'` without
// pulling the rest of the light object.
export {
  bg_app as lightBgApp,
  bg_surface as lightBgSurface,
  bg_surfaceElevated as lightBgSurfaceElevated,
  bg_surfaceMuted as lightBgSurfaceMuted,
  fg_textPrimary as lightFgTextPrimary,
  fg_textSecondary as lightFgTextSecondary,
  fg_textMuted as lightFgTextMuted,
  fg_textInverse as lightFgTextInverse,
  border as lightBorder,
  borderStrong as lightBorderStrong,
  borderFocus as lightBorderFocus,
  accent as lightAccent,
  accentHover as lightAccentHover,
  accentPressed as lightAccentPressed,
  success_bg as lightSuccessBg,
  success_fg as lightSuccessFg,
  success_border as lightSuccessBorder,
  warning_bg as lightWarningBg,
  warning_fg as lightWarningFg,
  warning_border as lightWarningBorder,
  danger_bg as lightDangerBg,
  danger_fg as lightDangerFg,
  danger_border as lightDangerBorder,
  info_bg as lightInfoBg,
  info_fg as lightInfoFg,
  info_border as lightInfoBorder,
  overlay as lightOverlay,
  disabled_bg as lightDisabledBg,
  disabled_fg as lightDisabledFg,
} from './light';

// Dark palette — values for every role under the `dark` scheme.
export { darkPalette } from './dark';

// Individual dark-palette leaves — sibling of the light re-exports
// above. Same rationale, same shape.
export {
  bg_app as darkBgApp,
  bg_surface as darkBgSurface,
  bg_surfaceElevated as darkBgSurfaceElevated,
  bg_surfaceMuted as darkBgSurfaceMuted,
  fg_textPrimary as darkFgTextPrimary,
  fg_textSecondary as darkFgTextSecondary,
  fg_textMuted as darkFgTextMuted,
  fg_textInverse as darkFgTextInverse,
  border as darkBorder,
  borderStrong as darkBorderStrong,
  borderFocus as darkBorderFocus,
  accent as darkAccent,
  accentHover as darkAccentHover,
  accentPressed as darkAccentPressed,
  success_bg as darkSuccessBg,
  success_fg as darkSuccessFg,
  success_border as darkSuccessBorder,
  warning_bg as darkWarningBg,
  warning_fg as darkWarningFg,
  warning_border as darkWarningBorder,
  danger_bg as darkDangerBg,
  danger_fg as darkDangerFg,
  danger_border as darkDangerBorder,
  info_bg as darkInfoBg,
  info_fg as darkInfoFg,
  info_border as darkInfoBorder,
  overlay as darkOverlay,
  disabled_bg as darkDisabledBg,
  disabled_fg as darkDisabledFg,
} from './dark';

// ----------------------------------------------------------------------------
// Spacing (Phase 2.3.2)
// ----------------------------------------------------------------------------
//
// One scale, eleven steps. The assembled `space` object and every
// individual leaf are exported. Spacing does not theme, so there are
// no `lightSpace*` / `darkSpace*` aliases — only one set of leaves.

export type { Spacing, SpacingStep, SpacingValue, SpacingScale } from './spacing';

// The assembled scale, frozen at construction. Consumers reach this
// through `theme.spacing` in a future `useTheme()` hook; for direct
// use today (tests, non-themed surfaces) the object is the export.
export { space } from './spacing';

// Individual leaves. Every step has its own `export const` so a
// bundler can drop unused steps from the output bundle. The aliases
// below use the convention `<step>` (no prefix) — a consumer reading
// `spaceMd` against the convention in the colour leaves will notice
// the difference, and the difference is intentional: colour leaves
// are scheme-prefixed because they are, spacing leaves are not.
export {
  space_3xs as space3xs,
  space_2xs as space2xs,
  space_xs as spaceXs,
  space_sm as spaceSm,
  space_md as spaceMd,
  space_lg as spaceLg,
  space_xl as spaceXl,
  space_2xl as space2xl,
  space_3xl as space3xl,
  space_4xl as space4xl,
  space_5xl as space5xl,
} from './spacing';

// ----------------------------------------------------------------------------
// Radius (Phase 2.3.3)
// ----------------------------------------------------------------------------
//
// One scale, seven steps. The assembled `radius` object and every
// individual leaf are exported. Radius does not theme, so there are
// no `lightRadius*` / `darkRadius*` aliases — only one set of leaves.

export type { Radius, RadiusStep, RadiusValue, RadiusScale } from './radius';

// The assembled scale, frozen at construction. Consumers reach this
// through `theme.radius` in a future `useTheme()` hook; for direct
// use today (tests, non-themed surfaces) the object is the export.
export { radius } from './radius';

// Individual leaves. Every step has its own `export const` so a
// bundler can drop unused steps from the output bundle. The aliases
// below use the convention `<step>` (no prefix) — same as spacing,
// same reason: a single set of leaves because the scale does not
// theme.
export {
  radius_none as radiusNone,
  radius_sm as radiusSm,
  radius_md as radiusMd,
  radius_lg as radiusLg,
  radius_xl as radiusXl,
  radius_2xl as radius2xl,
  radius_full as radiusFull,
} from './radius';

// ----------------------------------------------------------------------------
// Elevation (Phase 2.3.4)
// ----------------------------------------------------------------------------
//
// Six semantic levels, each a frozen metadata record. The scale
// does not theme; the leaf aliases are unprefixed, the same as
// spacing and radius.

export type {
  ElevationLevel,
  ElevationLevelMeta,
} from './elevation';

// The assembled scale, frozen at construction. Consumers reach
// this through `theme.elevation` in a future `useTheme()` hook;
// for direct use today (tests, non-themed surfaces) the object is
// the export.
export { elevation } from './elevation';

// Individual leaves. Every level has its own `export const` so a
// bundler can drop unused levels from the output bundle. The
// aliases below use the convention `<level>` (no prefix) — same
// as spacing and radius, same reason: a single set of leaves
// because the scale does not theme.
export {
  elevation_none as elevationNone,
  elevation_xs as elevationXs,
  elevation_sm as elevationSm,
  elevation_md as elevationMd,
  elevation_lg as elevationLg,
  elevation_xl as elevationXl,
} from './elevation';

// ----------------------------------------------------------------------------
// Borders (Phase 2.3.5)
// ----------------------------------------------------------------------------
//
// Five semantic levels, each a frozen metadata record. The scale
// does not theme; the leaf aliases are unprefixed, the same as
// spacing, radius, and elevation.

export type {
  BorderLevel,
  BorderWeight,
  BorderLevelMeta,
} from './borders';

// The assembled scale, frozen at construction. Consumers reach
// this through `theme.border` in a future `useTheme()` hook; for
// direct use today (tests, non-themed surfaces) the object is
// the export.
export { border } from './borders';

// Individual leaves. Every level has its own `export const` so a
// bundler can drop unused levels from the output bundle. The
// aliases below use the convention `<level>` (no prefix) — same
// as spacing, radius, and elevation, same reason: a single set
// of leaves because the scale does not theme.
export {
  border_none as borderNone,
  border_subtle as borderSubtle,
  border_default as borderDefault,
  border_strong as borderStrong,
  border_focus as borderFocus,
} from './borders';

// ----------------------------------------------------------------------------
// Motion (Phase 2.3.6)
// ----------------------------------------------------------------------------
//
// Motion is the sixth token subsystem to land, and the first **real-valued**
// one after spacing and radius. Two groups:
//
//   - `duration` — five semantic durations in milliseconds (instant / fast /
//                  normal / slow / slower).
//   - `easing`   — five cubic-bezier control-point tuples (linear / standard /
//                  accelerate / decelerate / emphasized).
//
//   import { duration, easing, type DurationStep, type EasingType } from '@genko/design/tokens';
//   import { duration_normal, easing_standard } from '@genko/design/tokens/motion';
//
// Like spacing, radius, elevation, and borders, motion does not theme — a
// transition takes the same time in light mode and dark mode, and the same
// curve. There are no `lightDurationNormal` / `darkEasingStandard` aliases.
//
// What this subsystem does **not** contain:
//   Composed transitions (`motion.transition.hover`, `motion.transition.press`,
//   `motion.transition.enter`, `motion.transition.exit`, `motion.transition.swap`,
//   `motion.transition.expand`) live in a future animation package. They are
//   bindings of a duration and an easing into a single intent, and separating
//   the binding from the values means a change to `duration.normal` propagates
//   to every composed transition without editing each one.
//
// Note on naming: the easing union is exported as `EasingType`, not aliased
// to `Easing`, because `Easing` is already a module in React Native. A future
// prop named `easing: Easing` would shadow the import. The longer name keeps
// the collision in mind for the future component phase.

export type {
  DurationStep,
  Duration,
  EasingCurve,
  EasingType,
  Easing,
} from './motion';

// The assembled scales, frozen at construction. Consumers reach these
// through `theme.motion.duration` and `theme.motion.easing` in a future
// `useTheme()` hook; for direct use today (tests, non-themed surfaces)
// the objects are the exports.
export { duration, easing } from './motion';

// Individual leaves. Every duration step and every easing curve has its
// own `export const` so a bundler can drop unused leaves from the output
// bundle. The aliases below use the convention `<step>` (no prefix) —
// same as spacing, radius, elevation, and borders, same reason: a single
// set of leaves because the scale does not theme.
export {
  // Duration leaves
  duration_instant as durationInstant,
  duration_fast as durationFast,
  duration_normal as durationNormal,
  duration_slow as durationSlow,
  duration_slower as durationSlower,
  // Easing leaves
  easing_linear as easingLinear,
  easing_standard as easingStandard,
  easing_accelerate as easingAccelerate,
  easing_decelerate as easingDecelerate,
  easing_emphasized as easingEmphasized,
} from './motion';

// ----------------------------------------------------------------------------
// Typography (Phase 2.3.7)
// ----------------------------------------------------------------------------
//
// Typography is the seventh token subsystem to land, and the broadest
// primitive one — five independent groups (fontFamily / fontSize /
// lineHeight / fontWeight / letterSpacing), each its own scale, each
// composed into a single `typography` namespace for consumer reads.
//
//   import { typography, type FontSize, type FontWeightStep } from '@genko/design/tokens';
//   import { fontSize_md, fontWeight_semibold } from '@genko/design/tokens/typography';
//
// Like spacing, radius, elevation, borders, and motion, typography
// does not theme — the design's size scale is the same in light and
// dark mode. There are no `lightFontSizeMd` / `darkLineHeightLg`
// aliases. A future per-user reading-preference layer (Phase 2's
// larger-text setting) would land as a *remap* of the existing scale,
// not a fork of every leaf — adding `fontSizeLargeMd` would create
// drift across every consumer, while remapping the existing values
// keeps the visual rhythm intact.
//
// What this subsystem does **not** contain:
//   - Semantic roles (Heading, Body, Caption, Button text, Display).
//     These are *compositions* of fontSize + lineHeight + fontFamily
//     + fontWeight — they live in a future role-composition phase
//     that picks which primitives combine for which surface.
//   - Larger display sizes (displayKana, displayKanji, displayNumber)
//     from Phase 2.2 — also role decisions, also deferred to a
//     role-composition phase that reads from the primitive scale
//     defined here.
//   - Letter-spacing in px. The values are stored in em units so the
//     spacing tracks with font size at every use; the platform
//     adapter multiplies. Storing px would freeze the design at a
//     single base size.
//
// Note on naming: the font-family union is exported as
// `FontFamilyKey`, not `FontFamily`, because `fontFamily` is already
// the assembled scale's export name. The step unions (FontSizeStep,
// LineHeightStep, FontWeightStep, LetterSpacingStep) follow the
// conventions established in motion / borders / elevation.

export type {
  FontFamilyKey,
  FontFamily,
  FontSizeStep,
  FontSize,
  LineHeightStep,
  LineHeight,
  FontWeightStep,
  FontWeight,
  LetterSpacingStep,
  LetterSpacing,
} from './typography';

// The five assembled groups, each frozen at construction. Consumers
// reach these through `theme.fontSize`, `theme.fontWeight`, etc. —
// independently of the composed `typography` namespace below.
export {
  fontFamily,
  fontSize,
  lineHeight,
  fontWeight,
  letterSpacing,
  typography,
} from './typography';

// Individual leaves. Every leaf has its own `export const` so a
// bundler can drop unused leaves from the output bundle. The aliases
// below use the convention `<group><Step>` (no theme prefix), same
// as the prior subsystems — the group prefix disambiguates the four
// size-ish unions (fontSize vs lineHeight vs fontWeight vs
// letterSpacing) at the call site.
export {
  // Font family arrays
  fontFamily_sans as fontFamilySans,
  fontFamily_ja as fontFamilyJa,
  fontFamily_jaBold as fontFamilyJaBold,
  fontFamily_mono as fontFamilyMono,

  // Font sizes
  fontSize_xs as fontSizeXs,
  fontSize_sm as fontSizeSm,
  fontSize_md as fontSizeMd,
  fontSize_lg as fontSizeLg,
  fontSize_xl as fontSizeXl,
  fontSize_2xl as fontSize2xl,
  fontSize_3xl as fontSize3xl,

  // Line heights (same step names — paired 1:1 with font sizes)
  lineHeight_xs as lineHeightXs,
  lineHeight_sm as lineHeightSm,
  lineHeight_md as lineHeightMd,
  lineHeight_lg as lineHeightLg,
  lineHeight_xl as lineHeightXl,
  lineHeight_2xl as lineHeight2xl,
  lineHeight_3xl as lineHeight3xl,

  // Font weights
  fontWeight_light as fontWeightLight,
  fontWeight_regular as fontWeightRegular,
  fontWeight_medium as fontWeightMedium,
  fontWeight_semibold as fontWeightSemibold,
  fontWeight_bold as fontWeightBold,

  // Letter spacing
  letterSpacing_tight as letterSpacingTight,
  letterSpacing_normal as letterSpacingNormal,
  letterSpacing_wide as letterSpacingWide,
} from './typography';
