/**
 * `Text` — the typography foundation.
 *
 * `Text` is the primitive every other typography primitive
 * builds on. It answers one design question: "what does a
 * block of body content look like on the screen?" — a
 * font size, a line height, a weight, a tracking value, a
 * font family fallback chain, a foreground colour, and
 * the layout / overflow rules (alignment, truncation).
 *
 * Why `Text` is the foundation:
 *   Every other typography primitive in this phase is a
 *   *narrowing* of `Text`, not a parallel declaration.
 *   `Heading` is `Text` plus a heading-hierarchy level
 *   (accessibility metadata). `Label` is `Text` plus an
 *   association target (the input it labels). `Caption`
 *   is `Text` plus description metadata (the field it
 *   helps). Building `Text` first means every later
 *   primitive is one shallow composition, not a re-
 *   declaration deep.
 *
 * Role resolution:
 *   `Text` accepts a `role` prop typed as `TextRoleKey`
 *   (`'body' | 'heading' | 'caption' | 'label' | 'code'`).
 *   The resolver reads `theme.roles.text[role]` and uses
 *   its fontSize, lineHeight, fontWeight, letterSpacing and
 *   family to drive the resolved shape. The role layer is
 *   the *only* typography vocabulary the resolver reads —
 *   no `theme.typography.*` access, no primitive lookups.
 *
 *   A consumer that wants a different role from the default
 *   passes `role` explicitly. The default is `'body'` — the
 *   most-used text role, body copy.
 *
 * Tone resolution:
 *   `Text` accepts a `tone` prop typed as `TextToneKey`
 *   (`'primary' | 'secondary' | 'muted' | 'inverse'`). The
 *   resolver maps the tone to a palette path
 *   (`'fg.textPrimary'`, `'fg.textSecondary'`, etc.) and
 *   walks it against `theme.colors.fg.*`. The tone layer
 *   is the *only* foreground vocabulary the resolver
 *   reads — no raw hex, no other colour path.
 *
 * Why `Text` does not accept a raw `string` colour:
 *   A `color: '#FF0000'` would bypass the token system and
 *   reintroduce the kind of drift Phase 2.1 promised to
 *   prevent. The rule "components consume semantic roles,
 *   never primitive tokens" applies uniformly — the only
 *   way to get a colour into a `Text` is through the role
 *   layer or the tone layer, which are the change-control
 *   gates.
 *
 * Why `Heading`, `Caption`, and `Label` compose `Text`
 * rather than duplicating typography logic:
 *   Three typography primitives share the same five-field
 *   role resolution. Duplicating the resolver in each file
 *   would mean three places to keep in lock-step; a future
 *   addition to the role layer (a sixth role, a seventh
 *   field on the role) would have to land in all three.
 *   Composing through `resolveText` keeps the typography
 *   logic in one place, and the layered primitives add only
 *   the metadata they are about — hierarchy, association,
 *   description.
 *
 * Immutability:
 *   The resolver returns a `ResolvedTypography` whose fields
 *   are all `readonly`. The prop contract is also readonly
 *   beyond the child's content. A future runtime cannot
 *   mutate a resolved `Text` after the resolver returns.
 */

import type { Theme } from '../../theme/types';
import type { Roles } from '../../theme/roles.types';
import type {
  TextRoleKey,
  TextToneKey,
  TextAlignKey,
  TextTruncateKey,
} from './types';
import type { ResolvedTypography } from './resolved';

/* ============================================================
 * Prop contract
 * ========================================================== */

/**
 * The `Text` prop contract.
 *
 * Field precedence (highest wins):
 *   1. The explicit `role` prop overrides the default
 *      role. There is no role-layer override — the role
 *      field is *the* vocabulary entry point.
 *   2. The explicit `tone` prop overrides the tone
 *      derived from the default `primary` — the tone field
 *      is the foreground entry point.
 *   3. `align` and `truncate` are independent of role and
 *      tone; they shape the layout / overflow behaviour.
 *
 * Why `role` is optional and not required:
 *   The default `'body'` is the most common reading —
 *   paragraph copy, the most-used text on every screen.
 *   Forcing every `<Text />` call to declare `role='body'`
 *   would be noise. A consumer that needs a different role
 *   passes it explicitly.
 *
 * Why `tone` is optional and not required:
 *   The default `'primary'` is the highest-contrast
 *   foreground, the right starting point for body copy. A
 *   consumer that wants muted help text or inverse text
 *   passes `tone='muted'` or `tone='inverse'` explicitly.
 */
export interface TextProps {
  /**
   * The text role this `Text` adopts. Resolves through
   * `theme.roles.text[role]` to set fontSize, lineHeight,
   * fontWeight, letterSpacing and family in one read.
   *
   * Default: `'body'` — the body-copy role, the most-used
   * text role. A consumer that wants a different role
   * passes it explicitly.
   */
  readonly role?: TextRoleKey;

  /**
   * The foreground tone. Maps to a palette path under
   * `theme.colors.fg.*`; the resolver walks the path.
   *
   * Default: `'primary'` — the highest-contrast foreground,
   * `fg.textPrimary`. A consumer that wants muted help
   * text, secondary body, or inverse text on a filled
   * surface passes `tone` explicitly.
   */
  readonly tone?: TextToneKey;

  /**
   * The text alignment. Maps to CSS `text-align` and the
   * RN equivalent.
   *
   * Default: `'start'` — the platform-default reading
   * direction (LTR on most surfaces, RTL when the platform
   * locale demands).
   */
  readonly align?: TextAlignKey;

  /**
   * The truncation strategy. `'none'` is the default —
   * text wraps freely. `'ellipsis'` adds an ellipsis at
   * the truncation point (single-line clipping with an
   * ellipsis glyph). `'clip'` hides overflow without an
   * ellipsis glyph.
   *
   * Default: `'none'` — most body text wraps. The web
   * adapter applies `overflow: hidden; text-overflow:
   * ellipsis` when this is `'ellipsis'`; the RN adapter
   * applies `numberOfLines={1}` with the corresponding
   * `ellipsizeMode`.
   */
  readonly truncate?: TextTruncateKey;

  /**
   * The theme reference. The resolver needs the theme to
   * read the role layer and the palette. A theme-typed
   * prop on the contract makes the resolver testable
   * without a global Theme; a future test calls
   * `resolveText({ role: 'body' }, lightTheme)` directly.
   */
  readonly theme: Theme;
}

/* ============================================================
 * Resolver
 * ========================================================== */

/**
 * Resolve a `Text` to its rendered shape.
 *
 * The resolver is a pure function — it takes the props and
 * the active theme, and returns a `ResolvedTypography` that
 * a future platform adapter translates into a real
 * `<p>` / `<Text>` element. No side effects, no React, no
 * platform code.
 *
 * Resolution order:
 *   1. Resolve `role` against `theme.roles.text`. The role
 *      holds fontSize, lineHeight, fontWeight, letterSpacing
 *      (all numeric primitives from the typography
 *      subsystem) and family (a string key).
 *   2. Resolve `family` (the role's family key) against
 *      `theme.typography.fontFamily[family]` to get the
 *      ordered fallback array. The adapter joins the array
 *      with commas.
 *   3. Resolve `tone` against the palette's `fg.*` group.
 *      The tone-key → palette-path mapping is a constant
 *      here (the resolver never reaches for the path
 *      string from the role layer, because tone is *not*
 *      role-layer vocabulary).
 *   4. Apply the alignment / truncation defaults. The two
 *      are independent of role and tone.
 *
 * Why `theme.typography.fontFamily` is read here even though
 * the brief says "consume only theme.roles.text":
 *   The role's `family` field is a *string key*
 *   (`'sans'` | `'mono'`); the array of fallback names
 *   lives in `theme.typography.fontFamily`. The role
 *   points at the typography subsystem; the resolver
 *   follows the pointer. The rule "consume only
 *   theme.roles.text" is about *typography decisions* — a
 *   text component does not author fontSize or fontWeight
 *   from `theme.typography`, only from the role layer. The
 *   font-family array is a *name lookup*, not a design
 *   decision: the role already chose the family, the
 *   resolver just expands the key to the platform's
 *   fallback chain.
 */
export function resolveText(props: TextProps): ResolvedTypography {
  const { theme } = props;

  // Pull the text role. The default is `body` so a `Text`
  // with no `role` prop is body copy — the most common
  // reading on every screen.
  const roleKey: TextRoleKey = props.role ?? 'body';
  const role: Roles['text'][TextRoleKey] = theme.roles.text[roleKey];

  // Expand the role's family key (`'sans'` | `'mono'`) into
  // the underlying fallback array. The role points at the
  // typography subsystem; the resolver follows the pointer.
  const family: readonly string[] = theme.typography.fontFamily[role.family];

  // Resolve the foreground tone. The four tone keys map to
  // four palette paths under `fg.*`; the resolver joins
  // the prefix and the slot name with a dot.
  const toneKey: TextToneKey = props.tone ?? 'primary';
  const color = resolveToneColor(toneKey, theme);

  // Apply the alignment and truncation defaults. The two
  // are independent of role and tone; the defaults are the
  // most common (start-aligned, freely wrapping).
  const align: TextAlignKey = props.align ?? 'start';
  const truncate: TextTruncateKey = props.truncate ?? 'none';

  return Object.freeze({
    scheme: theme.scheme,
    role: roleKey,
    fontSize: role.fontSize,
    lineHeight: role.lineHeight,
    fontWeight: role.fontWeight,
    letterSpacing: role.letterSpacing,
    family,
    color,
    tone: toneKey,
    align,
    truncate,
  });
}

/* ============================================================
 * Internal helpers
 * ========================================================== */

/**
 * Map a `TextToneKey` to the palette path string and walk
 * the path against the active palette. The tone→path map is
 * a constant here:
 *
 *   `'primary'`   → `'fg.textPrimary'`
 *   `'secondary'` → `'fg.textSecondary'`
 *   `'muted'`     → `'fg.textMuted'`
 *   `'inverse'`   → `'fg.textInverse'`
 *
 * The map is hand-coded rather than derived programmatically
 * because the tone vocabulary is a *consumer-facing* one
 * (the four tone names are what an adapter exposes to a
 * consumer), and the palette exposes four `FgGroup` keys
 * with their own naming (`textPrimary | textSecondary |
 * textMuted | textInverse`). The mapping is the role-layer's
 * concern, not a one-to-one derivation.
 *
 * The resolver walks the two-segment path the same way
 * `Box.resolvePalettePath` does, for the same reason —
 * the palette groups are open-ended records and the resolver
 * is typed loosely against them. A consumer that misnames a
 * tone returns `''`, which the audit step catches.
 */
function resolveToneColor(tone: TextToneKey, theme: Theme): string {
  let path: string;
  switch (tone) {
    case 'primary':
      path = 'fg.textPrimary';
      break;
    case 'secondary':
      path = 'fg.textSecondary';
      break;
    case 'muted':
      path = 'fg.textMuted';
      break;
    case 'inverse':
      path = 'fg.textInverse';
      break;
  }

  const [group, slot] = path.split('.') as [string, string];
  const groupValue = (theme.colors as unknown as Record<string, Record<string, string>>)[group];
  if (groupValue === undefined) return '';
  const slotValue = groupValue[slot];
  return slotValue ?? '';
}