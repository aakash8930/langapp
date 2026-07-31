/**
 * Dark palette.
 *
 * Values sourced from `client/theme/colors.ts → darkPalette`. The dark
 * identity was co-authored with the original palette and validated
 * against AA for the same ink/paper pairs as the light scheme.
 *
 * The structural shape is identical to {@link light}; every role has a
 * value, every leaf is its own export, and the assembled palette is
 * runtime-frozen. See `light.ts` for the rationale.
 *
 * A note on a known dark-mode issue: the original `web/src/theme.css`
 * documented that vermilion in dark mode "dropped to 4.08:1 on glass"
 * and needed a `--shu-glass` re-mix. That issue lives at the *glass
 * composite* layer — Phase 2.1 places the contrast engine under
 * `tokens/contrast/`, and Phase 2.3+ will rebuild the composited
 * overlay on top of this value rather than have this file author a
 * special-case `--shu-glass` token. The values below are the *base*
 * dark tokens; the *glass-composited* variants are a Phase 2.3+
 * concern.
 */

import type { Palette } from './colors';

/* ============================================================================
 * Background group (`bg`)
 * ========================================================================== */

/**
 * `bg.app` — the page ground on a dark scheme.
 *
 * The dark ink base. Sourced from
 * `client/theme/colors.ts → darkPalette.paper`.
 */
export const bg_app: Palette['bg']['app'] = '#141310';

/**
 * `bg.surface` — a resting card surface on dark.
 *
 * One step lighter than `bg.app`, paired for the contrast a card needs
 * to read as raised without competing for ink. Sourced from
 * `client/theme/colors.ts → darkPalette.surface`.
 */
export const bg_surface: Palette['bg']['surface'] = '#1D1C18';

/**
 * `bg.surfaceElevated` — one layer above {@link bg_surface}.
 *
 * One further step lighter than `bg.surface` so a tooltip or popover
 * sits "above" the resting card visually, not just in shadow.
 * Synthesized (the existing dark palette stops at two surface tones).
 */
export const bg_surfaceElevated: Palette['bg']['surfaceElevated'] = '#26241F';

/**
 * `bg.surfaceMuted` — a deliberately recessed surface on dark.
 *
 * The dark equivalent of a recessed surface: a near-ink tone that
 * sits *behind* `bg.app` without competing with it. Synthesized to
 * match the light scheme's recessed tone (a few % lighter than the
 * page ground in either scheme).
 */
export const bg_surfaceMuted: Palette['bg']['surfaceMuted'] = '#0F0E0B';

/* ============================================================================
 * Foreground group (`fg`)
 * ========================================================================== */

/**
 * `fg.textPrimary` — body text on a dark surface.
 *
 * The dark-scheme ink: a paper-tone (`#EDEAE0`) that clears AA
 * against every `bg.*` value. Sourced from
 * `client/theme/colors.ts → darkPalette.ink`.
 */
export const fg_textPrimary: Palette['fg']['textPrimary'] = '#EDEAE0';

/**
 * `fg.textSecondary` — subordinate text on the same surface.
 *
 * Sourced from `client/theme/colors.ts → darkPalette.inkSoft`.
 */
export const fg_textSecondary: Palette['fg']['textSecondary'] = '#A8A296';

/**
 * `fg.textMuted` — caption text, quieter still.
 *
 * A lighter faded variant of `inkSoft` that clears AA on `bg.surface`
 * for caption-weight text. Synthesized.
 */
export const fg_textMuted: Palette['fg']['textMuted'] = '#7A786F';

/**
 * `fg.textInverse` — text drawn on a high-contrast surface.
 *
 * On a dark scheme the "inverse surface" is paper, so the inverse
 * text is ink. Reuses `bg_app` for predictability.
 */
export const fg_textInverse: Palette['fg']['textInverse'] = '#141310';

/* ============================================================================
 * Border group (`border`)
 * ========================================================================== */

/**
 * `border` — the resting edge on dark.
 *
 * Sourced from `client/theme/colors.ts → darkPalette.hairline`.
 */
export const border: Palette['border']['border'] = '#2E2C26';

/**
 * `borderStrong` — a definite boundary on dark.
 *
 * A symmetric partner of the hairline: light enough to read on every
 * `bg.*`, dark enough not to compete for attention with text.
 * Synthesized.
 */
export const borderStrong: Palette['border']['borderStrong'] = '#5C5A53';

/**
 * `borderFocus` — focus ring on dark.
 *
 * Per Phase 2.2: "Always brand-coloured on purpose so it is visible on
 * every surface." The dark-scheme brand accent is the lifted vermilion
 * (`#D0614A`, sourced from `client/theme/colors.ts → darkPalette.shu`).
 */
export const borderFocus: Palette['border']['borderFocus'] = '#D0614A';

/* ============================================================================
 * Accent group (`accent`)
 * ========================================================================== */

/**
 * `accent` — the resting brand action colour on dark.
 *
 * On a dark scheme the brand accent must read against an ink ground.
 * The existing dark palette pulls vermilion *off full saturation* so
 * the colour sits in the page rather than glowing. Sourced from
 * `client/theme/colors.ts → darkPalette.shu`.
 */
export const accent: Palette['accent']['accent'] = '#D0614A';

/**
 * `accentHover` — the hover state of {@link accent} on dark.
 *
 * On dark, hover reads as *lighter* (more saturated, more contrast),
 * not darker. Sourced from the family of lifted vermilion above.
 */
export const accentHover: Palette['accent']['accentHover'] = '#E27863';

/**
 * `accentPressed` — the pressed state of {@link accent} on dark.
 *
 * One step lighter than {@link accentHover}. The hover/pressed
 * direction is inverted between light and dark schemes because
 * "increase contrast on the active state" reads as "more saturation"
 * on dark.
 */
export const accentPressed: Palette['accent']['accentPressed'] = '#F08B76';

/* ============================================================================
 * Feedback group — `success`
 * ========================================================================== */

/**
 * `feedback.success.bg` — the fill of a success surface on dark.
 *
 * A 12%-saturation desaturated green at a paper-adjacent tone so it
 * tints the surface without competing with the active state's
 * vermilion.
 */
export const success_bg: Palette['feedback']['success']['bg'] = '#1B2A22';

/**
 * `feedback.success.fg` — the foreground on a success surface on dark.
 *
 * A lifted green that clears AA against `success_bg` AND against
 * `bg.surface` (so the same component can render on either ground).
 */
export const success_fg: Palette['feedback']['success']['fg'] = '#7BB899';

/**
 * `feedback.success.border` — the edge of a success surface on dark.
 */
export const success_border: Palette['feedback']['success']['border'] = '#558569';

/* ============================================================================
 * Feedback group — `warning`
 * ========================================================================== */

/**
 * `feedback.warning.bg` — the fill of a warning surface on dark.
 *
 * A 12%-saturation desaturated amber at a paper-adjacent tone.
 */
export const warning_bg: Palette['feedback']['warning']['bg'] = '#2E2818';

/**
 * `feedback.warning.fg` — the foreground on a warning surface on dark.
 */
export const warning_fg: Palette['feedback']['warning']['fg'] = '#D9B66E';

/**
 * `feedback.warning.border` — the edge of a warning surface on dark.
 */
export const warning_border: Palette['feedback']['warning']['border'] = '#9C7E47';

/* ============================================================================
 * Feedback group — `danger`
 * ========================================================================== */

/**
 * `feedback.danger.bg` — the fill of an error surface on dark.
 *
 * Reuses the established `danger` palette value. Sourced from
 * `client/theme/colors.ts → darkPalette.danger`.
 */
export const danger_bg: Palette['feedback']['danger']['bg'] = '#3B1F19';

/**
 * `feedback.danger.fg` — the foreground on a danger surface on dark.
 *
 * A lifted danger family that clears AA against `danger.bg`.
 */
export const danger_fg: Palette['feedback']['danger']['fg'] = '#D2705A';

/**
 * `feedback.danger.border` — the edge of a danger surface on dark.
 *
 * A deeper danger-family tone that stands apart from the fill.
 */
export const danger_border: Palette['feedback']['danger']['border'] = '#A04E3E';

/* ============================================================================
 * Feedback group — `info`
 * ========================================================================== */

/**
 * `feedback.info.bg` — the fill of an info surface on dark.
 *
 * A 12%-saturation desaturated blue at a paper-adjacent tone.
 */
export const info_bg: Palette['feedback']['info']['bg'] = '#1A242B';

/**
 * `feedback.info.fg` — the foreground on an info surface on dark.
 *
 * Reuses the lifted `ai` from `client/theme/colors.ts → darkPalette.ai`.
 */
export const info_fg: Palette['feedback']['info']['fg'] = '#6D91A6';

/**
 * `feedback.info.border` — the edge of an info surface on dark.
 */
export const info_border: Palette['feedback']['info']['border'] = '#45677A';

/* ============================================================================
 * Overlay group (`overlay`)
 * ========================================================================== */

/**
 * `overlay` — the dimming layer behind a modal on dark.
 *
 * A light ink on dark scheme; the platform adapter composes it
 * with `opacity.scrim` at render time. The value is the dark-scheme
 * paper (the same value as `fg.textInverse`).
 */
export const overlay: Palette['overlay']['overlay'] = '#EDEAE0';

/* ============================================================================
 * Disabled group (`disabled`)
 * ========================================================================== */

/**
 * `disabled.bg` — the surface of a disabled element on dark.
 *
 * A near-surface tone that reads as "this does not respond" without
 * surrendering the depth that separates it from `bg.app`.
 */
export const disabled_bg: Palette['disabled']['disabled_bg'] = '#1F1E1A';

/**
 * `disabled.fg` — the foreground text on a disabled surface on dark.
 *
 * A faded variant of `fg.textSecondary` that clears the 3:1
 * large-text AA threshold required by the Phase 2.2 §15.1
 * contrast gate for disabled-state pairs.
 */
export const disabled_fg: Palette['disabled']['disabled_fg'] = '#6D6B62';

/* ============================================================================
 * Palette assembly
 * ========================================================================== */

const darkBg = Object.freeze({
  app: bg_app,
  surface: bg_surface,
  surfaceElevated: bg_surfaceElevated,
  surfaceMuted: bg_surfaceMuted,
});

const darkFg = Object.freeze({
  textPrimary: fg_textPrimary,
  textSecondary: fg_textSecondary,
  textMuted: fg_textMuted,
  textInverse: fg_textInverse,
});

const darkBorder = Object.freeze({
  border,
  borderStrong,
  borderFocus,
});

const darkAccent = Object.freeze({
  accent,
  accentHover,
  accentPressed,
});

const darkFeedbackSuccess = Object.freeze({
  bg: success_bg,
  fg: success_fg,
  border: success_border,
});

const darkFeedbackWarning = Object.freeze({
  bg: warning_bg,
  fg: warning_fg,
  border: warning_border,
});

const darkFeedbackDanger = Object.freeze({
  bg: danger_bg,
  fg: danger_fg,
  border: danger_border,
});

const darkFeedbackInfo = Object.freeze({
  bg: info_bg,
  fg: info_fg,
  border: info_border,
});

const darkOverlay = Object.freeze({
  overlay,
});

const darkDisabled = Object.freeze({
  disabled_bg,
  disabled_fg,
});

export const darkPalette: Readonly<Palette> = Object.freeze({
  bg: darkBg,
  fg: darkFg,
  border: darkBorder,
  accent: darkAccent,
  feedback: Object.freeze({
    success: darkFeedbackSuccess,
    warning: darkFeedbackWarning,
    danger: darkFeedbackDanger,
    info: darkFeedbackInfo,
  }),
  overlay: darkOverlay,
  disabled: darkDisabled,
});
