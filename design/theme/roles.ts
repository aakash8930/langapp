/**
 * Semantic theme roles — the final abstraction layer between
 * primitive tokens and components.
 *
 * Composition principle:
 *   Every field in every role below is a *reference* — a pointer
 *   to an existing primitive (or to a primitive-resolved member
 *   of it) — never a literal. No literal hex, no literal px, no
 *   literal ms. When a designer edits `space.md` from 16 to 18,
 *   every role whose `padding` resolves through that primitive
 *   picks up the change on the next read.
 *
 *   The colour-related fields are *path strings* (e.g. `'bg.app'`,
 *   `'border.borderFocus'`, `'feedback.danger.bg'`) — keys into
 *   whatever palette is mounted. `lightTheme` and `darkTheme`
 *   share the same path strings but resolve them against
 *   different palette values. A single roles object works for
 *   both schemes because the paths are scheme-independent; only
 *   the values behind them change.
 *
 *   The exceptions are:
 *     1. The `family` field on text roles, which holds a string
 *        literal like `'sans'`. This is not a value — it is a
 *        *key* that resolves at use time to
 *        `theme.typography.fontFamily.sans` (the array of font
 *        family fallbacks). Storing the key keeps the role type
 *        small and string-literal-typed.
 *     2. The `level` / `elevation` fields on surface and border
 *        roles, which hold a string literal like `'md'`. Same
 *        rationale — the level is a key, not a value.
 *
 * Mapping note:
 *   The colour subsystem calls the destructive-feedback family
 *   `feedback.danger.*` (the palette key is `danger`). The role
 *   layer surfaces that same family under `state.error` — the
 *   consumer-facing name. The path strings here still match the
 *   palette keys (`'feedback.danger.bg'`, etc.); only the role's
 *   outer key is renamed.
 *
 * What this file does NOT do:
 *   - Define new colours. Every colour path resolves through
 *     `Palette['bg']`, `Palette['fg']`, `Palette['border']`,
 *     `Palette['feedback']`, etc. — the colour subsystem owns
 *     the values.
 *   - Define new spacing values. Every spacing reference
 *     resolves through `SpacingScale['md']`-style indexed access
 *     on the existing scale.
 *   - Define new typography scales. Every typography role
 *     references primitives by member name (fontSize_xs,
 *     lineHeight_md, etc.).
 *   - Implement React, hooks, or a Provider. This is the value
 *     layer; the runtime layer reads it.
 *
 * Immutability:
 *   The assembled `roles` object is `Object.freeze`d recursively.
 *   Every leaf value is already `as const` from its subsystem,
 *   so runtime mutation is rejected by the engine; the surrounding
 *   `Object.freeze` makes it rejected at every nesting level.
 *
 *   A future theme (highContrastRoles, sepiaRoles) lands as a
 *   sibling file that follows the same composition rules — only
 *   the colour paths stay identical (they are path strings, not
 *   values) and the values they point at change in the new
 *   palette. That symmetry is the property Phase 2.1 promised:
 *   "components read semantic roles, themes supply the values".
 */

import type {
  TextRole,
  SurfaceRole,
  BorderRole,
  IconRole,
  StateRole,
  FocusRole,
  ControlRole,
  Roles,
} from './roles.types';

import {
  fontSize_xs,
  fontSize_sm,
  fontSize_md,
  fontSize_lg,
  fontWeight_regular,
  fontWeight_medium,
  fontWeight_semibold,
  fontWeight_bold,
  lineHeight_xs,
  lineHeight_sm,
  lineHeight_md,
  lineHeight_lg,
  letterSpacing_normal,
  letterSpacing_tight,
} from '../tokens/typography';

import { space_xs, space_sm, space_md, space_lg, space_xl } from '../tokens/spacing';
import { radius_md, radius_lg } from '../tokens/radius';

/* ============================================================
 * Internal: per-namespace factories
 * ========================================================== */

/**
 * Per-namespace factories exist because the alternatives —
 * a single object literal that nests every role group — would
 * be both visually crowded and harder to audit. Each factory
 * returns a frozen, fully-typed slice of `Roles` and is built
 * entirely from existing primitive references.
 *
 * The factories are not public: they live here, beside their
 * callsite, used exactly once each. A consumer reaches the
 * role layer through `roles.text.body`, never through
 * `createTextRoles`.
 */

function buildTextRoles(): Readonly<Roles['text']> {
  /**
   * `body` — the most-used text role. Size and line height both
   * resolve through the `md` step of each primitive; weight is
   * `regular`; tracking is `normal`; family is the
   * latin/default group key.
   *
   * `caption` and `label` deliberately step *down* from body —
   * caption uses the `xs` size, label uses `sm`. A label is
   * still body-weight (no need to pull attention), but sits
   * one step smaller because labels are typically inline.
   */
  const body: TextRole = Object.freeze({
    fontSize: fontSize_md,
    lineHeight: lineHeight_md,
    fontWeight: fontWeight_regular,
    letterSpacing: letterSpacing_normal,
    family: 'sans',
  });

  /**
   * `heading` uses `lg` size (one step above body), `semibold`
   * weight (the title-card weight from the scale), and `tight`
   * tracking — large sizes track tighter per the typography
   * note in `typography.ts`. `family: 'sans'` keeps headings
   * on latin/default — kanji/kana content reads at body sizes
   * inside the heading block, not as the heading glyph itself.
   */
  const heading: TextRole = Object.freeze({
    fontSize: fontSize_lg,
    lineHeight: lineHeight_lg,
    fontWeight: fontWeight_semibold,
    letterSpacing: letterSpacing_tight,
    family: 'sans',
  });

  /**
   * `caption` is the smallest readable. `xs` size, `xs`
   * line. Weight stays `regular`. Tracking slightly tighter
   * than body so small text doesn't feel airy.
   */
  const caption: TextRole = Object.freeze({
    fontSize: fontSize_xs,
    lineHeight: lineHeight_xs,
    fontWeight: fontWeight_regular,
    letterSpacing: letterSpacing_tight,
    family: 'sans',
  });

  /**
   * `label` — text on form controls and similar. `sm` size,
   * `medium` weight (one notch above body so labels read as
   * owning the field). Normal tracking.
   */
  const label: TextRole = Object.freeze({
    fontSize: fontSize_sm,
    lineHeight: lineHeight_sm,
    fontWeight: fontWeight_medium,
    letterSpacing: letterSpacing_normal,
    family: 'sans',
  });

  /**
   * `code` — same size as body, but `bold` weight keeps the
   * monospace glyphs feeling anchored against proportional
   * neighbours. `family: 'mono'` resolves to the monospace
   * fallback chain at use time.
   */
  const code: TextRole = Object.freeze({
    fontSize: fontSize_md,
    lineHeight: lineHeight_md,
    fontWeight: fontWeight_bold,
    letterSpacing: letterSpacing_normal,
    family: 'mono',
  });

  return Object.freeze({ body, heading, caption, label, code });
}

/**
 * `surface.page` — the page-wide ground. Reads `bg.app` from
 * whatever palette is in use (light or dark). Elevation `none`
 * — the page is flat. Padding `space.xs` so consumers
 * starting from the role have a non-zero default. Radius
 * `radius.md`.
 *
 * `surface.card` — a resting card surface. `bg.surface` (one
 * step above the page). Elevation `sm` (the level that
 * introduces a quiet shadow). Padding `md` (a card's natural
 * internal padding). Radius `md`.
 *
 * `surface.elevated` — a tooltip or popover (one layer above
 * card). `bg.surfaceElevated`. Elevation `md`. Padding `sm`
 * (popovers tend to be tightly packed). Radius `lg`.
 *
 * `surface.overlay` — a modal sheet or bottom drawer.
 * `bg.surface` (modals are loud enough on their own without a
 * different colour). Elevation `lg` (clearly above everything
 * else). Padding `lg`. Radius `lg`.
 *
 * Radius is a member reference too — every SurfaceRole.radius
 * is a frozen `number` from `tokens/radius.ts`. Editing
 * `radius_md = 8` to `radius_md = 10` propagates to every
 * surface that uses it without revisiting this file.
 */
function buildSurfaceRoles(): Readonly<Roles['surface']> {
  const page: SurfaceRole = Object.freeze({
    background: 'bg.app',
    elevation: 'none',
    padding: space_xs,
    radius: radius_md,
  });

  const card: SurfaceRole = Object.freeze({
    background: 'bg.surface',
    elevation: 'sm',
    padding: space_md,
    radius: radius_md,
  });

  const elevated: SurfaceRole = Object.freeze({
    background: 'bg.surfaceElevated',
    elevation: 'md',
    padding: space_sm,
    radius: radius_lg,
  });

  const overlay: SurfaceRole = Object.freeze({
    background: 'bg.surface',
    elevation: 'lg',
    padding: space_lg,
    radius: radius_lg,
  });

  return Object.freeze({ page, card, elevated, overlay });
}

/**
 * Border roles — colour × level. The colour slot is a *path*
 * into the palette (`'border.default'`,
 * `'border.borderFocus'`); the level is one of the five
 * border levels (`default`, `focus`). The two combine at
 * render time.
 *
 * The colour subsystem's `BorderGroup` exposes three values
 * named `border | borderStrong | borderFocus`. The role layer
 * maps these to the path strings a consumer reads:
 *   - `roles.border.default.color` = `'border.border'`
 *     (the primary resting edge — palette key `border`)
 *   - `roles.border.focus.color` = `'border.borderFocus'`
 *     (the focus ring — palette key `borderFocus`)
 *
 * Note that `border.borderStrong` is reachable through the
 * palette but not surfaced as a named role here — it exists
 * as a primitive palette entry for future role work (a
 * future phase might add `roles.border.strong`). The current
 * needs (default + focus) are what components ask for today.
 */
function buildBorderRoles(): Readonly<Roles['border']> {
  const def: BorderRole = Object.freeze({
    color: 'border.border',
    level: 'default',
  });

  const focus: BorderRole = Object.freeze({
    color: 'border.borderFocus',
    level: 'focus',
  });

  return Object.freeze({ default: def, focus });
}

/**
 * Icon roles — colour × size. `icon.default` uses the
 * primary-text foreground (`fg.textPrimary`, the full-
 * contrast reading). `icon.muted` uses the muted foreground
 * (caption-equivalent contrast for an inactive icon).
 * `icon.accent` uses the secondary foreground
 * (`fg.textSecondary` — one notch below primary, the
 * "active affordance" reading).
 *
 * Sizes use spacing values because icon size is part of the
 * design's spacing rhythm — an icon at `space.md` reads as
 * the same scale as a card with `space.md` internal padding.
 * A future iconography token category may add `icon.size.*`
 * primitives; the role shape here stays the same.
 *
 * Why no `fg.textBrand` slot for `icon.accent`:
 *   The colour subsystem's `FgGroup` in `colors.ts` exposes
 *   four slots (`textPrimary | textSecondary | textMuted |
 *   textInverse`); it does not yet expose a `textBrand`
 *   slot. Mapping `icon.accent` to `fg.textSecondary` keeps
 *   the path valid against the palette, which is the property
 *   the contract needs (the runtime must resolve the path,
 *   not fail with `undefined`). When the colour subsystem
 *   adds `textBrand`, this role maps to it automatically by
 *   flipping the literal value — one line, no type change.
 */
function buildIconRoles(): Readonly<Roles['icon']> {
  const def: IconRole = Object.freeze({
    color: 'fg.textPrimary',
    size: space_md,
  });

  const muted: IconRole = Object.freeze({
    color: 'fg.textMuted',
    size: space_md,
  });

  const accent: IconRole = Object.freeze({
    color: 'fg.textSecondary',
    size: space_md,
  });

  return Object.freeze({ default: def, muted, accent });
}

/**
 * State roles — feedback.<success|warning|error|info>.
 *
 * The roles compose the four slots every feedback surface
 * needs: background, foreground (typically a contrast icon
 * stroke), border, and body-text colour. The path strings
 * map to existing palette entries — no new colours are
 * introduced here.
 *
 * Mapping: `state.error` reads `feedback.danger.*` from the
 * palette. The colour subsystem calls the destructive-
 * feedback family `feedback.danger` (a four-key pattern
 * alongside `feedback.success`, `feedback.warning`,
 * `feedback.info`); the role layer surfaces that family
 * under the consumer-facing name `state.error`. The path
 * string (`'feedback.danger.bg'`, etc.) is correct against
 * the palette; only the role's outer key is renamed.
 *
 * `text` mirrors `foreground` per feedback family — feedback
 * surfaces typically draw body copy at the foreground
 * colour, not at a separate text colour, so re-using the
 * foreground role keeps the contract simple. A future
 * feedback.<state>.textOn slot would surface here if a
 * design needs it.
 */
function buildStateRoles(): Readonly<Roles['state']> {
  const success: StateRole = Object.freeze({
    background: 'feedback.success.bg',
    foreground: 'feedback.success.fg',
    border: 'feedback.success.border',
    text: 'feedback.success.fg',
  });

  const warning: StateRole = Object.freeze({
    background: 'feedback.warning.bg',
    foreground: 'feedback.warning.fg',
    border: 'feedback.warning.border',
    text: 'feedback.warning.fg',
  });

  const error: StateRole = Object.freeze({
    background: 'feedback.danger.bg',
    foreground: 'feedback.danger.fg',
    border: 'feedback.danger.border',
    text: 'feedback.danger.fg',
  });

  const info: StateRole = Object.freeze({
    background: 'feedback.info.bg',
    foreground: 'feedback.info.fg',
    border: 'feedback.info.border',
    text: 'feedback.info.fg',
  });

  return Object.freeze({ success, warning, error, info });
}

/**
 * Focus roles — `default` and `keyboard`. Both currently
 * resolve to the same colour (`'border.borderFocus'`, the
 * focus ring slot in the palette) and width (`space_xs`).
 * The two slots exist so a future enhancement (e.g. an
 * icon-only variant or a high-contrast variant) can read
 * from a different slot without renaming the
 * general-purpose one.
 *
 * The width is a spacing value rather than a border-width
 * primitive because border-widths are a future token category
 * (the design currently uses only 1px). When that category
 * lands, the focus role's `width` field changes from `number`
 * to `BorderWidth` — a one-line edit, no role rename.
 */
function buildFocusRoles(): Readonly<Roles['focus']> {
  const def: FocusRole = Object.freeze({
    color: 'border.borderFocus',
    width: space_xs,
  });

  const keyboard: FocusRole = Object.freeze({
    color: 'border.borderFocus',
    width: space_xs,
  });

  return Object.freeze({ default: def, keyboard });
}

/**
 * Control role — a singleton, not a group. `control` is the
 * shape a button or input occupies: `xl` height (a generous
 * touch target), `sm` padding inside, `md` corner radius.
 *
 * No colour slot — a control's colour resolves from its
 * `surface.*` and `state.*` roles; mixing colour into
 * control shape would pin colour to shape and force every
 * colour variant into its own control shape, which is the
 * wrong invariant (a primary button and a secondary button
 * share shape, differ only in colour).
 */
function buildControlRole(): ControlRole {
  return Object.freeze({
    height: space_xl,
    padding: space_sm,
    radius: radius_md,
  });
}

/* ============================================================
 * Public assembly
 * ========================================================== */

/**
 * The semantic roles object — the final layer between
 * primitives and components. Every component reads this
 * object through the runtime Theme provider (Phase 2.3+),
 * never the primitives directly.
 *
 * The shape is exactly `Roles` from `./roles.types.ts`. The
 * composition here is a tree of Object.freeze'd slices, each
 * built from references (not literals) to existing primitives
 * — so changing a primitive once reaches every role that
 * reads it on the next module reload.
 *
 * Why this is `Object.freeze`d at every nesting level rather
 * than a single frozen shell:
 *   Deep-frozen by hand (every interior object too). A
 *   consumer doing `roles.text.body.fontSize = 18` throws in
 *   strict mode at runtime; TypeScript stops them at compile
 *   time via the `readonly` annotations on `TextRole`.
 */
export const roles: Roles = Object.freeze({
  text: buildTextRoles(),
  surface: buildSurfaceRoles(),
  border: buildBorderRoles(),
  icon: buildIconRoles(),
  state: buildStateRoles(),
  focus: buildFocusRoles(),
  control: buildControlRole(),
});
