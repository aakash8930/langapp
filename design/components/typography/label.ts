/**
 * `Label` — a typography primitive with form-control
 * association metadata.
 *
 * `Label` is `Text` plus a single piece of accessibility
 * metadata: the `htmlFor` target that ties a label to the
 * form control it labels. The association is *structural*
 * — the web adapter forwards `htmlFor` as the HTML `for`
 * attribute (which is what screen readers and form
 * autofill rely on); the RN adapter uses it as the
 * `accessibilityLabelledBy` target.
 *
 * Why `Label` composes `Text` rather than re-declaring the
 * typography contract:
 *   `Label` is `Text` plus one field. Re-declaring the
 *   typography resolver here would mean *two* places to
 *   keep in lock-step — a future change to the role
 *   resolution logic would have to land in both. Composing
 *   through `resolveText` keeps the typography logic in one
 *   place, and `Label` adds only the association metadata.
 *
 * Why `Label` is a primitive and not a styled `Text`:
 *   `Label` carries *semantic* information that `Text` does
 *   not. A `Text` is a paragraph; a `Label` is a form-
 *   control marker that screen readers and form autofill
 *   depend on for accessibility. The visual style is the
 *   role layer's `label` role, which is also reachable
 *   through `Text` with `role='label'` — but the
 *   association metadata is the part that makes a `Label`
 *   a `Label` and not a `Text`.
 *
 * Role resolution:
 *   `Label` accepts a `role` prop typed as `TextRoleKey`,
 *   passed through to `resolveText`. The default role is
 *   `'label'` (matching the role layer's `label` entry —
 *   size `sm`, weight `medium`, normal tracking, family
 *   `sans`). A consumer that wants a different role passes
 *   it explicitly.
 *
 * Why `htmlFor` is optional:
 *   Some labels are not associated with a specific control
 *   — a `<Field>` composite that binds a label and a control
 *   together internally, or a label that wraps its control
 *   implicitly through DOM structure (HTML's nested-label
 *   pattern). The association is optional; the adapter
 *   falls back to no-attribute when `htmlFor` is unset.
 *   A consumer that knows the association should pass it
 *   explicitly so screen readers and autofill can use it.
 */

import type { Theme } from '../../theme/types';
import type {
  TextRoleKey,
  TextToneKey,
  TextAlignKey,
  TextTruncateKey,
} from './types';
import type { ResolvedLabel } from './resolved';
import { resolveText } from './text';

/* ============================================================
 * Prop contract
 * ========================================================== */

/**
 * The `Label` prop contract.
 *
 * Composes `TextProps` (sans `theme` — re-declared on this
 * contract to keep the type self-contained) plus the
 * `htmlFor` association target. Every other text prop
 * flows through `Text` unchanged.
 */
export interface LabelProps {
  /**
   * The identifier of the labelled control, or `undefined`
   * when the label is not associated with a specific
   * control. The web adapter forwards this as the HTML
   * `for` attribute; the RN adapter uses it as the
   * `accessibilityLabelledBy` target.
   *
   * Optional: a label that wraps its control implicitly
   * (HTML's nested-label pattern, a `<Field>` composite
   * that binds internally) does not need an explicit
   * target. A label that stands alone or sits beside its
   * control should pass `htmlFor` so the association is
   * structural, not visual.
   */
  readonly htmlFor?: string;

  /**
   * The text role this `Label` adopts. Resolves through
   * `theme.roles.text[role]`, same as `Text`.
   *
   * Default: `'label'` — the form-control role from the
   * role layer. A consumer that wants a different role
   * (e.g. body-weight label copy) passes it explicitly.
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
 * Resolve a `Label` to its rendered shape.
 *
 * The resolver composes `resolveText` (which composes the
 * role and tone lookups) and adds the `htmlFor` association
 * target. The typography fields are inherited from the
 * composed `resolveText` call; the `htmlFor` field is
 * carried through unchanged.
 *
 * `role` is required-or-defaulted (defaulting to `'label'`),
 * so the resolver does not need a role default. `htmlFor`
 * is optional — the resolver omits the field from the
 * resolved shape when unset, and the adapter falls back to
 * no association attribute.
 *
 * Why the resolved shape conditionally carries `htmlFor`:
 *   `exactOptionalPropertyTypes` rejects `htmlFor: undefined`
 *   against a `readonly htmlFor?: string` field. The
 *   resolver omits the field entirely when unset (rather
 *   than carrying `undefined`), and the adapter falls back
 *   to no-association.
 */
export function resolveLabel(props: LabelProps): ResolvedLabel {
  // Compose the typography resolution through `Text`. The
  // `role` default is `label`; the resolver passes through
  // any override the consumer set. The `tone` / `align` /
  // `truncate` props are passed through only when set —
  // `exactOptionalPropertyTypes` rejects explicit
  // `undefined` against an optional field, so we
  // conditionally spread each prop.
  const typography = resolveText({
    role: props.role ?? 'label',
    ...(props.tone !== undefined && { tone: props.tone }),
    ...(props.align !== undefined && { align: props.align }),
    ...(props.truncate !== undefined && { truncate: props.truncate }),
    theme: props.theme,
  });

  // The `htmlFor` field is independent of the typography
  // resolution — accessibility metadata, not visual
  // styling. The resolver carries it through when set,
  // omitting the field from the resolved shape when unset
  // (the adapter falls back to no-association).
  if (props.htmlFor !== undefined) {
    return Object.freeze({
      ...typography,
      htmlFor: props.htmlFor,
    });
  }

  return Object.freeze({
    ...typography,
  });
}