/**
 * Typography primitives — resolved output shapes.
 *
 * The resolved shapes are the values a future platform
 * adapter (Phase 2.4+) translates into a real `<p>` /
 * `<h1>` / `<label>` / `<RNText>` tree. A component file
 * in this phase authors a *prop contract* (input) and a
 * *resolver function* (the input→output transformation);
 * the resolved shape is the contract between the two halves.
 *
 * Why resolved shapes are declared separately from the
 * prop contracts:
 *   A resolver takes `TextProps` (or `HeadingProps`, etc.)
 *   and a `Theme`, and returns a `ResolvedText`. The
 *   returned shape is platform-neutral — it has no `style`,
 *   no `className`, no `Text` intrinsic — only the design
 *   values an adapter will translate. A separate declaration
 *   makes the contract between component logic and adapter
 *   logic explicit, and lets the resolver be unit-tested
 *   with a smaller fixture than the prop contract would
 *   suggest.
 *
 * Why every field is a primitive `number` / `string` /
 * `readonly string[]` and not a token reference:
 *   The resolver runs *before* the adapter. By the time the
 *   resolved shape reaches the adapter, every role has been
 *   looked up, every scale step resolved, every tone path
 *   walked. The adapter receives values, not vocabulary.
 *   This is what makes the adapter a stable translation
 *   layer — it does not need to know what a "role" is, only
 *   what a colour string or a pixel value is.
 *
 * What's deliberately not in the resolved shapes:
 *   - No `style` object. A web adapter wraps the resolved
 *     fields into a CSS object; a native adapter wraps them
 *     into an RN style. The combining is the adapter's
 *     job, not the resolver's.
 *   - No event handlers. Typography primitives are non-
 *     interactive in this phase.
 *   - No `children`. The resolved shape is the *parent's*
 *     contract; children are passed through unchanged.
 *   - No accessibility *behaviour*. The resolver passes
 *     accessibility metadata through (heading level,
 *     association target) but does not synthesise platform
 *     accessibility attributes. The adapter translates the
 *     metadata into the platform's actual a11y primitives.
 */

import type { ColorScheme } from '../../tokens/colors';
import type {
  TextRoleKey,
  TextToneKey,
  TextAlignKey,
  TextTruncateKey,
  HeadingLevelKey,
} from './types';

/* ============================================================
 * Resolved: typography-derived fields
 * ========================================================== */

/**
 * The fully-resolved fields a typography primitive hands
 * to an adapter. Every field is a primitive value (a number,
 * a hex string, an array of font-family strings) — no
 * vocabulary survives the resolver, only design intent.
 *
 * `scheme` is the active colour scheme at resolve time,
 * kept on the resolved shape for the same reason
 * `ResolvedSurface` keeps it: a future audit pass can compare
 * a component's resolved scheme against the active theme
 * without re-deriving it.
 *
 * `family` is the *array* of fallback font names — the
 * resolver expands `roles.text[role].family` (a string key
 * like `'sans'`) into the underlying `fontFamily[role]`
 * array. The adapter joins the array with commas for CSS
 * or passes it through to RN's `fontFamily` prop. The
 * resolver never returns the string key; the array is the
 * platform-neutral output.
 *
 * `letterSpacing` is a numeric em value (e.g. `-0.02`).
 * The adapter multiplies against the resolved `fontSize`
 * to get a CSS `letter-spacing` declaration or an RN
 * `letterSpacing` prop (which the framework expects in
 * points). The em-unit storage is the property that
 * survives a font-size change without retuning the scale
 * (see `tokens/typography.ts` for the rationale).
 *
 * `color` is the resolved foreground hex — the role layer's
 * `ToneKey` already mapped to a palette path, the resolver
 * walked the path against `theme.colors.fg.*`. The adapter
 * passes it straight through.
 */
export interface ResolvedTypography {
  /** The active scheme at resolve time — `'light'` or `'dark'`. */
  readonly scheme: ColorScheme;

  /**
   * The semantic role key the resolver picked up — `'body'
   * | 'heading' | 'caption' | 'label' | 'code'`. Carried
   * through so the adapter can decide on platform-specific
   * routing (e.g. web adapter mapping `code` to `<code>`
   * instead of `<p>`).
   */
  readonly role: TextRoleKey;

  /** The resolved font size, in pixels. */
  readonly fontSize: number;

  /** The resolved line height, in pixels. */
  readonly lineHeight: number;

  /** The resolved font weight — a numeric CSS value (e.g. `600`). */
  readonly fontWeight: number;

  /** The resolved letter spacing, in em units. */
  readonly letterSpacing: number;

  /**
   * The resolved font-family fallback chain — an ordered
   * `readonly string[]`. The adapter joins the chain into
   * the platform's font-family declaration.
   */
  readonly family: readonly string[];

  /** The resolved foreground colour — a hex string. */
  readonly color: string;

  /** The tone key the resolver picked up. */
  readonly tone: TextToneKey;

  /** The resolved text alignment. */
  readonly align: TextAlignKey;

  /** The resolved truncation strategy. */
  readonly truncate: TextTruncateKey;
}

/* ============================================================
 * Resolved: heading-derived fields
 * ========================================================== */

/**
 * The fully-resolved heading. Composes `ResolvedTypography`
 * with a single `level` field that carries the accessibility
 * hierarchy (`'h1'` through `'h6'`).
 *
 * The level is *not* visual styling — every `h1`-`h6`
 * currently reads the same `heading` text role. The level
 * is metadata the adapter forwards to the platform's
 * accessibility tree (HTML `<h1>` vs `<h2>`, RN
 * `accessibilityRole`).
 */
export interface ResolvedHeading extends ResolvedTypography {
  /** The heading hierarchy level — `'h1'` through `'h6'`. */
  readonly level: HeadingLevelKey;
}

/* ============================================================
 * Resolved: label-derived fields
 * ========================================================== */

/**
 * The fully-resolved label. Composes `ResolvedTypography`
 * with the association metadata that ties a label to its
 * target form control.
 *
 * `htmlFor` is the platform-neutral identifier of the
 * element the label labels. The web adapter forwards it as
 * the HTML `for` attribute; the RN adapter uses it as the
 * `accessibilityLabelledBy` target. `undefined` means the
 * label is *not* associated with a specific control — the
 * adapter wraps it in a span/View without an association
 * attribute (a fallback for cases where the association is
 * implicit through layout, e.g. a `<Field>` composite that
 *   binds label + control internally).
 */
export interface ResolvedLabel extends ResolvedTypography {
  /**
   * The identifier of the labelled control, or `undefined`
   * when the label is not associated with a specific
   * control.
   */
  readonly htmlFor?: string;
}

/* ============================================================
 * Resolved: caption-derived fields
 * ========================================================== */

/**
 * The fully-resolved caption. Composes `ResolvedTypography`
 * with the description metadata that ties a caption to the
 * element it describes.
 *
 * A caption's primary purpose is *helper text* — "this
 * field is required", "password must be 8+ characters", etc.
 * The `describedBy` field carries the identifier of the
 * element the caption describes; the web adapter wires it
 * to `aria-describedby`, the RN adapter to
 * `accessibilityDescribedBy`. `undefined` means the caption
 * stands alone.
 *
 * `id` is the caption's own identifier — the inverse of
 * `describedBy`. A consumer may set either or both; the
 * resolver does not enforce uniqueness, and the adapter
 * passes them through. A caption that is itself described
 * by another element (e.g. a tooltip that describes the
 * caption) sets `id` and lets the other element reference
 * it.
 */
export interface ResolvedCaption extends ResolvedTypography {
  /** The caption's own identifier, if any. */
  readonly id?: string;

  /**
   * The identifier of the element this caption describes,
   * or `undefined` when the caption stands alone.
   */
  readonly describedBy?: string;
}