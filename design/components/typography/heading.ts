/**
 * `Heading` — a typography primitive with hierarchy metadata.
 *
 * `Heading` is `Text` plus a single piece of accessibility
 * metadata: the heading level (`'h1'` through `'h6'`). The
 * level is *not* visual styling — every `h1`-`h6` currently
 * reads the same `heading` text role. The level is
 * semantic information the adapter forwards to the
 * platform's accessibility tree.
 *
 * Why `Heading` composes `Text` rather than re-declaring the
 * typography contract:
 *   `Heading` is `Text` plus one field. Re-declaring the
 *   typography resolver here would mean *two* places to keep
 *   in lock-step — a future change to the role resolution
 *   logic would have to land in both. Composing through
 *   `resolveText` keeps the typography logic in one place,
 *   and `Heading` adds only the hierarchy metadata.
 *
 *   The composition is the same shape as `Flex` extending
 *   `Box`, or `Stack` extending `Flex` — a shallow
 *   composition that adds exactly the new field, not a
 *   parallel declaration that drifts.
 *
 * Why `Heading` is a primitive and not a styled `Text`:
 *   `Heading` carries *semantic* information that `Text`
 *   does not. A `Text` is a paragraph; a `Heading` is a
 *   document-section marker that accessibility tools treat
 *   as distinct (screen readers, document outlines, the
 *   browser's heading map). Conflating the two loses that
 *   semantic information. The role resolves to the same
 *   visual style today, but the level field is independent
 *   — and the right primitive is the one that carries the
 *   metadata.
 *
 * Role resolution:
 *   `Heading` accepts a `role` prop typed as `TextRoleKey`,
 *   passed through to `resolveText`. The default role is
 *   `'heading'` (matching the role layer's `heading`
 *   entry). A consumer that wants body-style heading copy
 *   (a sub-heading that reads at body weight) passes
 *   `role='body'` explicitly.
 *
 *   Note that `Heading` defaults to `role='heading'` and
 *   `Text` defaults to `role='body'`. The two primitives
 *   start at the right role for their semantic context;
 *   a consumer that needs a different role passes it
 *   explicitly.
 */

import type { Theme } from '../../theme/types';
import type {
  TextRoleKey,
  TextToneKey,
  TextAlignKey,
  TextTruncateKey,
  HeadingLevelKey,
} from './types';
import type { ResolvedHeading } from './resolved';
import { resolveText } from './text';

/* ============================================================
 * Prop contract
 * ========================================================== */

/**
 * The `Heading` prop contract.
 *
 * Composes `TextProps` (sans `theme` — re-declared on this
 * contract to keep the type self-contained) plus the
 * heading-level prop. Every other text prop flows through
 * `Text` unchanged.
 *
 * Why `theme` is re-declared on this contract rather than
 * inherited:
 *   TypeScript's interface extension propagates the field
 *   automatically when the parent interface declares it.
 *   The `theme: Theme` field is required by the resolver
 *   and lives on every typography primitive's prop
 *   contract. Re-declaring it on `HeadingProps` keeps the
 *   contract self-documenting — a reader sees the field
 *   without chasing the parent.
 *
 * Why `level` is required:
 *   A heading without a level is ambiguous — accessibility
 *   tools treat every level as distinct, and the design
 *   does not author a "default" heading level. Forcing the
 *   consumer to declare the level makes the document
 *   structure explicit. A consumer that needs a different
 *   default level set should compose their own primitive
 *   rather than rely on an implicit default.
 *
 * Why `role` defaults to `'heading'` and not `'body'`:
 *   A `Heading` with body styling is rare. The role layer
 *   ships a `heading` role precisely for this case. A
 *   consumer that wants body-style heading copy passes
 *   `role='body'` explicitly — the default is the
 *   common-case role.
 */
export interface HeadingProps {
  /**
   * The heading hierarchy level — `'h1'` through `'h6'`.
   * Required. The resolver carries the level through to
   * the resolved shape; the adapter forwards it to the
   * platform's accessibility tree.
   */
  readonly level: HeadingLevelKey;

  /**
   * The text role this `Heading` adopts. Resolves through
   * `theme.roles.text[role]`, same as `Text`.
   *
   * Default: `'heading'` — the heading-role entry from the
   * role layer. A consumer that wants body-style heading
   * copy passes `role='body'` explicitly.
   */
  readonly role?: TextRoleKey;

  /** The foreground tone. Same semantics as on `Text`. */
  readonly tone?: TextToneKey;

  /** The text alignment. Same semantics as on `Text`. */
  readonly align?: TextAlignKey;

  /** The truncation strategy. Same semantics as on `Text`. */
  readonly truncate?: TextTruncateKey;

  /** The active theme — required. */
  readonly theme: Theme;
}

/* ============================================================
 * Resolver
 * ========================================================== */

/**
 * Resolve a `Heading` to its rendered shape.
 *
 * The resolver composes `resolveText` (which composes the
 * role and tone lookups) and rewrites the `role` field on
 * the returned shape — the consumer's `level` prop is
 * carried through unchanged, the typography fields are
 * inherited from the composed `resolveText` call.
 *
 * `level` and `role` are required-or-defaulted props, so
 * the resolver does not need defaults. The absence of a
 * default keeps the contract narrow: a `Heading` always
 * knows its level and its role.
 */
export function resolveHeading(props: HeadingProps): ResolvedHeading {
  // Compose the typography resolution through `Text`. The
  // `role` default is `heading`; the resolver passes
  // through any override the consumer set. The
  // `tone` / `align` / `truncate` props are passed through
  // only when set — `exactOptionalPropertyTypes` rejects
  // explicit `undefined` against an optional field, so
  // we conditionally spread each prop.
  const typography = resolveText({
    role: props.role ?? 'heading',
    ...(props.tone !== undefined && { tone: props.tone }),
    ...(props.align !== undefined && { align: props.align }),
    ...(props.truncate !== undefined && { truncate: props.truncate }),
    theme: props.theme,
  });

  // The level field is independent of the typography
  // resolution — accessibility metadata, not visual
  // styling. The resolver carries it through unchanged.
  return Object.freeze({
    ...typography,
    level: props.level,
  });
}