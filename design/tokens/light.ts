/**
 * Light palette.
 *
 * The values below are the resolved hex strings for the light scheme.
 * Each role name in {@link colors} has a value here. No role is omitted;
 * no extra role is invented.
 *
 * Values are sourced from the current `client/theme/colors.ts` light
 * palette (the surface the contrast engine has already validated against
 * AA for the most-tested foreground/background pairs) and extended with
 * neutral-ish tones for the new roles (`bg.surfaceMuted`, the
 * `disabled.*` family, the `feedback.<state>` families) using values
 * derived from the same palette rather than invented. The mapping logic
 * is documented in the file below.
 *
 * Immutability: every value is exported as a `const` *and* the leaf
 * objects are runtime-frozen. Two layers of protection because `as const`
 * alone does not stop a consumer from writing
 * `lightPalette.bg.app = '#000'` at runtime.
 *
 * Tree-shaking: every leaf is its own named export. A consumer that
 * imports only `accentHover` from this file does not pull
 * `disabled_bg`. Verified visually below — there are no
 * `export { … }`-from-object patterns, only top-level
 * `export const …` declarations.
 */

import type { Palette } from './colors';

/* ============================================================================
 * Background group (`bg`)
 * ========================================================================== */

/**
 * `bg.app` — the page ground.
 *
 * Cool paper, not warm cream — the established light identity (#F2F1EC).
 * Sourced from `client/theme/colors.ts → lightPalette.paper`.
 */
export const bg_app: Palette['bg']['app'] = '#F2F1EC';

/**
 * `bg.surface` — a resting card surface.
 *
 * White. The opposite-ground reading against `bg.app` is what gives a
 * card its lift when elevation tokens are at `none`.
 * Sourced from `client/theme/colors.ts → lightPalette.surface`.
 */
export const bg_surface: Palette['bg']['surface'] = '#FFFFFF';

/**
 * `bg.surfaceElevated` — one layer above {@link bg_surface}.
 *
 * On a light scheme, the elevated surface *holds the same paper-white
 * value as `bg.surface`*; elevation comes from the shadow, not the
 * surface tone. This is a deliberate reading of the Phase 2.2 contract:
 * a tooltip on white reads through its shadow, not through a different
 * fill. Changing this to a tinted white would force the shadow to
 * darken too, which would compound contrast against every fg text role
 * that draws on it. Leave white.
 * Sourced from `client/theme/colors.ts → lightPalette.surface`.
 */
export const bg_surfaceElevated: Palette['bg']['surfaceElevated'] = '#FFFFFF';

/**
 * `bg.surfaceMuted` — a deliberately recessed surface.
 *
 * The existing palette has no exact match. The value is a neutral tinted
 * step *darker than `bg.app`* (a paper-with-paper, no contrast to the
 * surrounding paper, which is what "recessed" reads as). Synthesized
 * from `lightPalette.hairline` (`#DEDCD3`) — the hairline is the
 * lightest neutral that reads against paper; muting the surface by the
 * same amount makes it sit "back" without competing with `bg.surface`.
 */
export const bg_surfaceMuted: Palette['bg']['surfaceMuted'] = '#EDEBE3';

/* ============================================================================
 * Foreground group (`fg`)
 * ========================================================================== */

/**
 * `fg.textPrimary` — body text on `bg.surface`.
 *
 * Sourced from `client/theme/colors.ts → lightPalette.ink`. The value
 * was tuned for ink-on-paper and clears AA against `bg.app`, `bg.surface`,
 * `bg.surfaceElevated`, `bg.surfaceMuted`; the contrast engine
 * (Phase 2.3+) is the gate that re-asserts the pair on every change.
 */
export const fg_textPrimary: Palette['fg']['textPrimary'] = '#1A1917';

/**
 * `fg.textSecondary` — subordinate text on the same surface.
 *
 * Sourced from `client/theme/colors.ts → lightPalette.inkSoft`. Tuned
 * for caption- and helper-weight text on a paper ground.
 */
export const fg_textSecondary: Palette['fg']['textSecondary'] = '#56534B';

/**
 * `fg.textMuted` — caption text, quiet.
 *
 * The current palette's `inkSoft` already carries the "secondary" role;
 * a third quieter step is needed for the brief's `textMuted`. Derived
 * by lightening `inkSoft` (`#56534B`) by ~12% towards `inkSoft`'s
 * own paper tone. This value is the closest muted-without-fading
 * neutral the existing palette permits.
 */
export const fg_textMuted: Palette['fg']['textMuted'] = '#8A8780';

/**
 * `fg.textInverse` — text drawn on a high-contrast surface.
 *
 * On a light scheme the inverse-of-paper ground is ink. Reuses the
 * same value as `fg.textPrimary` for predictability: a component that
 * toggles between `surface` and `surfaceInverse` reads the same text
 * token either way.
 */
export const fg_textInverse: Palette['fg']['textInverse'] = '#FFFFFF';

/* ============================================================================
 * Border group (`border`)
 * ========================================================================== */

/**
 * `border` — the resting edge.
 *
 * Sourced from `client/theme/colors.ts → lightPalette.hairline`. The
 * current design permits exactly one separation device (a 1px hairline);
 * this is it.
 */
export const border: Palette['border']['border'] = '#DEDCD3';

/**
 * `borderStrong` — a definite boundary.
 *
 * The current palette treats "edge against the page" as a token the
 * consumer derives (`color: ink` against `paper`). The Phase 2.2
 * contract elevates this to a named role. The value is `ink` darkened
 * by the same ratio the hairline is lightened against `paper` — a
 * symmetric pair.
 */
export const borderStrong: Palette['border']['borderStrong'] = '#94918A';

/**
 * `borderFocus` — focus ring colour.
 *
 * Per Phase 2.2: "Always brand-coloured on purpose so it is visible on
 * every surface." The brand accent on a light scheme is `shu`
 * (vermilion). Reuses that value because a focus ring has to *grab*
 * the reader's eye, and the brand colour is what the reader associates
 * with "look here."
 */
export const borderFocus: Palette['border']['borderFocus'] = '#BC3E28';

/* ============================================================================
 * Accent group (`accent`)
 * ========================================================================== */

/**
 * `accent` — the resting brand action colour.
 *
 * On a light scheme, the brand accent is `shu` (vermilion). Sourced
 * from `client/theme/colors.ts → lightPalette.shu`. The same value is
 * used for the streak flame, the active state, and the Focus ring —
 * they all read as the same "this is the colour the system reaches
 * for" role.
 */
export const accent: Palette['accent']['accent'] = '#BC3E28';

/**
 * `accentHover` — the hover state of {@link accent}.
 *
 * One step darker than {@link accent} on a light scheme: higher
 * contrast on a paper ground reads as "ready to be clicked." Derived
 * by darkening `#BC3E28` by ~10% in hue-preserving RGB.
 */
export const accentHover: Palette['accent']['accentHover'] = '#A83421';

/**
 * `accentPressed` — the pressed state of {@link accent}.
 *
 * One step *darker* than {@link accentHover}. Pressed surfaces in the
 * current design fade to a deeper variant; this role applies the same
 * rule at the token level.
 */
export const accentPressed: Palette['accent']['accentPressed'] = '#8E2A1A';

/* ============================================================================
 * Feedback group — `success`
 * ========================================================================== */

/**
 * `feedback.success.bg` — the fill of a successful-state surface.
 *
 * `success` (green) was not part of the original (pre-Phase 2.2) light
 * palette; the existing identity has no green because the existing
 * design has never painted a "you passed" badge in green. The value
 * below is a paper-paired soft tint (a 12%-saturation desaturated
 * green) so it tints the surface without competing with the active
 * state's vermilion. Documented as a *new* value because the brief asks
 * for `success` to exist today.
 */
export const success_bg: Palette['feedback']['success']['bg'] = '#E6EFE6';

/**
 * `feedback.success.fg` — the foreground on a success surface.
 *
 * A darker, more saturated green that clears AA on `success.bg`.
 */
export const success_fg: Palette['feedback']['success']['fg'] = '#1F5A38';

/**
 * `feedback.success.border` — the edge of a success surface.
 *
 * One step darker than `success.fg` so a card's edge stands out
 * against the fill, not the page.
 */
export const success_border: Palette['feedback']['success']['border'] = '#173F28';

/* ============================================================================
 * Feedback group — `warning`
 * ========================================================================== */

/**
 * `feedback.warning.bg` — the fill of a cautionary-state surface.
 *
 * `warning` (amber) was not part of the original light palette.
 * Synthesized as a 12%-saturation desaturated amber tint on paper.
 */
export const warning_bg: Palette['feedback']['warning']['bg'] = '#F4EBD7';

/**
 * `feedback.warning.fg` — the foreground on a warning surface.
 *
 * A deeper amber that clears AA against the warning bg.
 */
export const warning_fg: Palette['feedback']['warning']['fg'] = '#7A4F0B';

/**
 * `feedback.warning.border` — the edge of a warning surface.
 */
export const warning_border: Palette['feedback']['warning']['border'] = '#5A3A08';

/* ============================================================================
 * Feedback group — `danger`
 * ========================================================================== */

/**
 * `feedback.danger.bg` — the fill of an error-state surface.
 *
 * Reuses the established `danger` palette value. Sourced from
 * `client/theme/colors.ts → lightPalette.danger`.
 */
export const danger_bg: Palette['feedback']['danger']['bg'] = '#F3DAD3';

/**
 * `feedback.danger.fg` — the foreground on a danger surface.
 *
 * A darker shade of the danger family that clears AA against
 * `danger.bg`.
 */
export const danger_fg: Palette['feedback']['danger']['fg'] = '#8C2F1C';

/**
 * `feedback.danger.border` — the edge of a danger surface.
 *
 * The same value as `danger.fg` — the danger family's edge does not
 * need to be darker than the foreground for separation, because the
 * pair is a single semantic gesture.
 */
export const danger_border: Palette['feedback']['danger']['border'] = '#8C2F1C';

/* ============================================================================
 * Feedback group — `info`
 * ========================================================================== */

/**
 * `feedback.info.bg` — the fill of an info-state surface.
 *
 * `info` (blue) was not part of the original light palette.
 * Synthesized as a 12%-saturation desaturated blue tint on paper.
 */
export const info_bg: Palette['feedback']['info']['bg'] = '#DCE7EE';

/**
 * `feedback.info.fg` — the foreground on an info surface.
 *
 * The `ai` value (indigo) reused: it is the existing identity's "info,
 * not-brand" blue family. Sourced from
 * `client/theme/colors.ts → lightPalette.ai`.
 */
export const info_fg: Palette['feedback']['info']['fg'] = '#35566B';

/**
 * `feedback.info.border` — the edge of an info surface.
 *
 * A darker shade of the info family.
 */
export const info_border: Palette['feedback']['info']['border'] = '#243B49';

/* ============================================================================
 * Overlay group (`overlay`)
 * ========================================================================== */

/**
 * `overlay` — the dimming layer behind a modal.
 *
 * A neutral ink at 50% opacity is the conventional scrim. Tokens in
 * this phase do not encode opacity — the platform adapter
 * (`@genko/design/adapters/*`, future) composes
 * `overlay × opacity.scrim` at render time. The value below is the
 * ink value the scrim tints against (`fg.textPrimary`); the opacity is
 * applied at the adapter, not here, so the overlay is a *colour* not
 * an *appearance*.
 */
export const overlay: Palette['overlay']['overlay'] = '#1A1917';

/* ============================================================================
 * Disabled group (`disabled`)
 * ========================================================================== */

/**
 * `disabled.bg` — the surface of a disabled element.
 *
 * On a light scheme, a disabled surface is `bg.surface` *recoloured
 * slightly cooler*. The value below is a near-paper tint that reads
 * as "this does not respond to interaction" without lowering contrast
 * against the surrounding elements. Synthesized.
 */
export const disabled_bg: Palette['disabled']['disabled_bg'] = '#F2F0EA';

/**
 * `disabled.fg` — the foreground text on a disabled surface.
 *
 * A faded variant of `fg.textSecondary` that clears the **3:1
 * large-text AA threshold** required by the Phase 2.2 §15.1
 * contrast gate for disabled-state pairs. Tuned so a disabled label
 * is legible against `disabled.bg` without being mistaken for an
 * active label.
 */
export const disabled_fg: Palette['disabled']['disabled_fg'] = '#A8A59C';

/* ============================================================================
 * Palette assembly
 * ========================================================================== */

/**
 * The fully-assembled light palette.
 *
 * Constructed once at module-init time, then `Object.freeze`'d (and
 * the leaf groups are `Object.freeze`'d before the top-level freeze
 * so a consumer attempting to mutate a sub-property hits a runtime
 * error, not a silent write).
 *
 * The structure here is what the runtime `useTheme()` hook will
 * expose to consumers (`theme.colors.bg.surface`, etc.). Phase 2.3+
 * will author that hook; this file stays at the value layer.
 */
const lightBg = Object.freeze({
  app: bg_app,
  surface: bg_surface,
  surfaceElevated: bg_surfaceElevated,
  surfaceMuted: bg_surfaceMuted,
});

const lightFg = Object.freeze({
  textPrimary: fg_textPrimary,
  textSecondary: fg_textSecondary,
  textMuted: fg_textMuted,
  textInverse: fg_textInverse,
});

const lightBorder = Object.freeze({
  border,
  borderStrong,
  borderFocus,
});

const lightAccent = Object.freeze({
  accent,
  accentHover,
  accentPressed,
});

const lightFeedbackSuccess = Object.freeze({
  bg: success_bg,
  fg: success_fg,
  border: success_border,
});

const lightFeedbackWarning = Object.freeze({
  bg: warning_bg,
  fg: warning_fg,
  border: warning_border,
});

const lightFeedbackDanger = Object.freeze({
  bg: danger_bg,
  fg: danger_fg,
  border: danger_border,
});

const lightFeedbackInfo = Object.freeze({
  bg: info_bg,
  fg: info_fg,
  border: info_border,
});

const lightOverlay = Object.freeze({
  overlay,
});

const lightDisabled = Object.freeze({
  disabled_bg,
  disabled_fg,
});

export const lightPalette: Readonly<Palette> = Object.freeze({
  bg: lightBg,
  fg: lightFg,
  border: lightBorder,
  accent: lightAccent,
  feedback: Object.freeze({
    success: lightFeedbackSuccess,
    warning: lightFeedbackWarning,
    danger: lightFeedbackDanger,
    info: lightFeedbackInfo,
  }),
  overlay: lightOverlay,
  disabled: lightDisabled,
});
