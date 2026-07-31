/**
 * `Caption` — a typography primitive with description
 * metadata.
 *
 * `Caption` is `Text` plus two pieces of accessibility
 * metadata: an `id` (the caption's own identifier, so other
 * elements can reference it) and a `describedBy` (the
 * identifier of the element the caption describes). The
 * association is *structural* — the web adapter forwards
 * `describedBy` as the `aria-describedby` attribute on
 * the described element, and `id` as the caption's own
 * DOM id; the RN adapter uses the two as the
 * `accessibilityDescribedBy` target.
 *
 * Why `Caption` composes `Text` rather than re-declaring the
 * typography contract:
 *   `Caption` is `Text` plus two fields. Re-declaring the
 *   typography resolver here would mean *two* places to
 *   keep in lock-step — a future change to the role
 *   resolution logic would have to land in both. Composing
 *   through `resolveText` keeps the typography logic in one
 *   place, and `Caption` adds only the description
 *   metadata.
 *
 * Why `Caption` is a primitive and not a styled `Text`:
 *   `Caption` carries *semantic* information that `Text`
 *   does not. A `Text` is a paragraph; a `Caption` is a
 *   helper-text marker that screen readers and form
 *   validation depend on for accessibility. The visual
 *   style is the role layer's `caption` role, which is also
 *   reachable through `Text` with `role='caption'` — but
 *   the description metadata is the part that makes a
 *   `Caption` a `Caption` and not a `Text`.
 *
 * Role resolution:
 *   `Caption` accepts a `role` prop typed as `TextRoleKey`,
 *   passed through to `resolveText`. The default role is
 *   `'caption'` (matching the role layer's `caption` entry
 *   — size `xs`, line `xs`, weight `regular`, tracking
 *   `tight`, family `sans`). A consumer that wants a
 *   different role passes it explicitly.
 *
 * Why both `id` and `describedBy` are optional:
 *   A caption may stand alone (no `id` because nothing
 *   references it; no `describedBy` because it does not
 *   describe a specific element). A caption may describe a
 *   field (no `id`; `describedBy` set). A caption may itself
 *   be described by another element (e.g. a tooltip that
 *   describes the caption — `id` set so the tooltip can
 *   reference it). The two fields are independent; the
 *   resolver passes them through.
 */

import type { Theme } from '../../theme/types';
import type {
  TextRoleKey,
  TextToneKey,
  TextAlignKey,
  TextTruncateKey,
} from './types';
import type { ResolvedCaption } from './resolved';
import { resolveText } from './text';

/* ============================================================
 * Prop contract
 * ========================================================== */

/**
 * The `Caption` prop contract.
 *
 * Composes `TextProps` (sans `theme` — re-declared on this
 * contract to keep the type self-contained) plus the
 * description-metadata props (`id` and `describedBy`).
 * Every other text prop flows through `Text` unchanged.
 */
export interface CaptionProps {
  /**
   * The caption's own identifier, if any. The web adapter
   * forwards this as the caption's DOM id; other elements
   * can then reference it through `aria-describedby`.
   *
   * Optional: a caption that is not referenced by another
   * element does not need an id. The adapter falls back to
   * no-id when this is unset.
   */
  readonly id?: string;

  /**
   * The identifier of the element this caption describes,
   * or `undefined` when the caption stands alone. The web
   * adapter forwards this as `aria-describedby` on the
   * described element; the RN adapter uses it as the
   * `accessibilityDescribedBy` target.
   *
   * Optional: a caption that does not describe a specific
   * element (free-floating helper text) does not need a
   * `describedBy`. The adapter falls back to no-association
   * when this is unset.
   */
  readonly describedBy?: string;

  /**
   * The text role this `Caption` adopts. Resolves through
   * `theme.roles.text[role]`, same as `Text`.
   *
   * Default: `'caption'` — the helper-text role from the
   * role layer. A consumer that wants a different role
   * passes it explicitly.
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
 * Resolve a `Caption` to its rendered shape.
 *
 * The resolver composes `resolveText` (which composes the
 * role and tone lookups) and adds the `id` and `describedBy`
 * description-metadata fields. The typography fields are
 * inherited from the composed `resolveText` call; the
 * description fields are carried through unchanged when
 * set.
 *
 * `role` is required-or-defaulted (defaulting to `'caption'`),
 * so the resolver does not need a role default. `id` and
 * `describedBy` are independently optional — the resolver
 * carries each through when set, omitting from the resolved
 * shape when unset.
 *
 * Why the resolved shape conditionally carries `id` and
 * `describedBy`:
 *   `exactOptionalPropertyTypes` rejects
 *   `id: undefined` against a `readonly id?: string` field.
 *   The resolver omits the field entirely when unset (rather
 *   than carrying `undefined`), and the adapter falls back
 *   to no-association.
 */
export function resolveCaption(props: CaptionProps): ResolvedCaption {
  // Compose the typography resolution through `Text`. The
  // `role` default is `caption`; the resolver passes through
  // any override the consumer set. The `tone` / `align` /
  // `truncate` props are passed through only when set —
  // `exactOptionalPropertyTypes` rejects explicit
  // `undefined` against an optional field, so we
  // conditionally spread each prop.
  const typography = resolveText({
    role: props.role ?? 'caption',
    ...(props.tone !== undefined && { tone: props.tone }),
    ...(props.align !== undefined && { align: props.align }),
    ...(props.truncate !== undefined && { truncate: props.truncate }),
    theme: props.theme,
  });

  // The `id` and `describedBy` fields are independent of
  // the typography resolution — accessibility metadata,
  // not visual styling. The resolver carries each through
  // when set, omitting the field from the resolved shape
  // when unset (the adapter falls back to no-association).
  if (props.id !== undefined && props.describedBy !== undefined) {
    return Object.freeze({
      ...typography,
      id: props.id,
      describedBy: props.describedBy,
    });
  }
  if (props.id !== undefined) {
    return Object.freeze({
      ...typography,
      id: props.id,
    });
  }
  if (props.describedBy !== undefined) {
    return Object.freeze({
      ...typography,
      describedBy: props.describedBy,
    });
  }
  return Object.freeze({
    ...typography,
  });
}