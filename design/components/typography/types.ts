/**
 * Typography primitives — shared type contracts.
 *
 * Four primitives in this phase: `Text`, `Heading`, `Label`,
 * `Caption`. Each consumes a *semantic* text role from
 * `theme.roles.text` rather than raw typography primitives —
 * this is what the brief calls "consume only theme.roles.text,
 * never theme.typography, never theme.colors, never primitive
 * tokens". The typography subsystem is the only entry point
 * a future component uses when it needs text styling.
 *
 * The shared contracts declared here:
 *
 *   1. `TextRoleKey`      — a key into `theme.roles.text`
 *                           (body | heading | caption | label | code)
 *   2. `TextToneKey`      — a foreground-tone key
 *                           (primary | secondary | muted | inverse)
 *   3. `TextAlignKey`     — a CSS `text-align` value
 *                           (start | center | end | justify)
 *   4. `TextTruncateKey`  — the truncation strategy
 *                           (none | ellipsis | clip)
 *   5. `HeadingLevelKey`  — a heading hierarchy level
 *                           (h1 | h2 | h3 | h4 | h5 | h6)
 *
 * Each of these is a *union*, not a numeric enum — adding a
 * tone or a heading level is a one-line addition that
 * propagates through every consumer that reads the union.
 *
 * Why these contracts live in their own file rather than per-
 * component:
 *   Four typography primitives share `TextRoleKey` and
 *   `TextToneKey`. Per-component declarations of
 *   `type TextRoleKey = keyof Roles['text']` would drift the
 *   moment one of them is refactored. One declaration is the
 *   property that keeps the typography vocabulary coherent.
 *
 * Why `TextAlignKey` is four values rather than five (no
 * `'match-parent'`):
 *   The platform adapters (CSS + RN) both accept `start | center
 *   | end | justify` and translate them to the platform's
 *   equivalent (`'left' | 'right'` are LTR-only on web, RN
 *   uses `'auto'` for the inverse). `'match-parent'` is a CSS
 *   feature without an RN equivalent; excluding it keeps the
 *   contract symmetric across surfaces.
 */

import type { Roles } from '../../theme/roles.types';

/* ============================================================
 * Role / tone keys
 * ========================================================== */

/**
 * A key into `theme.roles.text`. The five named text roles
 * the design ships — `body` is the most common reading, the
 * others are specialised. Every typography primitive reads
 * this key and resolves the matching role's fontSize,
 * lineHeight, fontWeight, letterSpacing and family.
 *
 * Note that `Heading` and `Caption` and `Label` are *also*
 * typography primitives but they read `TextRoleKey` too —
 * their component-specific behaviour (heading hierarchy,
 * label association) is layered on top of the same five
 * roles, not a separate vocabulary.
 */
export type TextRoleKey = keyof Roles['text'];

/**
 * A foreground-tone key. The palette exposes four foreground
 * slots (`textPrimary | textSecondary | textMuted |
 * textInverse`); the role layer maps them to consumer-facing
 * tone names.
 *
 * The default tone (`primary`) resolves to `fg.textPrimary`,
 * the highest-contrast reading. `muted` is the caption-
 * equivalent contrast for inactive text; `secondary` is one
 * notch below primary; `inverse` is the colour drawn *on* an
 * inverse surface (a button label on a filled button).
 *
 * Why tones are surfaced at the component layer and not at
 * the role layer:
 *   The role layer's `TextRole` describes *how* text is
 *   rendered — size, line, weight, tracking, family. Tone is
 *   orthogonal: the same `body` role can be drawn in `primary`
 *   or `muted` foreground colour. Pairing a role with a tone
 *   at the resolver layer is what makes "the same body
 *   paragraph, drawn as muted help text" a single component
 *   call.
 */
export type TextToneKey =
  | 'primary'
  | 'secondary'
  | 'muted'
  | 'inverse';

/* ============================================================
 * Layout / overflow keys
 * ========================================================== */

/**
 * A CSS `text-align` value. The platform adapters (CSS + RN)
 * both accept these four values; the resolver hands them
 * through unchanged. `'justify'` is included for the rare
 * justified paragraph, but is *not* the default for body.
 */
export type TextAlignKey =
  | 'start'
  | 'center'
  | 'end'
  | 'justify';

/**
 * A text-truncation strategy. `'none'` is the default — text
 * wraps freely. `'ellipsis'` is the single-line strategy with
 * an ellipsis at the truncation point (CSS `text-overflow:
 * ellipsis`, RN `numberOfLines={1}`). `'clip'` is the rare
 * case where overflow is hidden without an ellipsis glyph.
 *
 * The resolver does not implement truncation behaviour — it
 * only records the strategy. The adapter applies it.
 */
export type TextTruncateKey =
  | 'none'
  | 'ellipsis'
  | 'clip';

/* ============================================================
 * Heading hierarchy
 * ========================================================== */

/**
 * A heading hierarchy level — `'h1'` through `'h6'`. The
 * resolver does not change the visual role based on the
 * level (all `h1`-`h6` currently read the same `heading`
 * text role); the level is *accessibility metadata* that
 * the adapter forwards to the platform's accessibility
 * tree (HTML heading element, RN `accessibilityRole:
 * 'header'`).
 *
 * Why heading levels are six values when the role layer
 * has one `heading` style:
 *   Visual styling says "this is a heading". Document
 *   semantics say "this is *which* heading" — accessibility
 *   tools (screen readers, document outlines, the
 *   browser's heading map) treat every level as distinct.
 *   Conflating the two loses the semantic information. The
 *   resolver exposes both as separate fields so an adapter
 *   can wire them to the right platform attribute.
 *
 * `'h1'` is the strongest heading on a screen; `'h6'` is the
 * weakest. The resolver does not enforce ordering — a screen
 * that needs `h4` after `h2` can author that directly. The
 * adapter does not validate; the consumer is the source of
 * truth on document structure.
 */
export type HeadingLevelKey =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6';