/**
 * `Spacer` — a layout utility that grows to fill its
 * container's leftover space.
 *
 * `Spacer` is the primitive that pushes siblings apart.
 * A card with a header, body, and footer, where the body
 * grows to fill the remaining height, is a `Stack` with a
 * `<Spacer />` between the body and the footer. The
 * spacer's base size is its minimum size (the space it
 * always claims), and it grows beyond that when siblings
 * leave leftover space.
 *
 * Why a separate primitive and not a flex-grow prop on
 * `Box`:
 *   `flex-grow` is a flex-layout concern. The other layout
 *   primitives (`Box`, `Flex`, `Stack`) compose *within*
 *   the flex system; `Spacer` is the primitive that
 *   participates *as* a flex item. Separating it makes
 *   the contract clear: a `Spacer` is a flex item that
 *   grows; a `Box` / `Flex` / `Stack` is a flex container.
 *
 * Why `axis` is required:
 *   A `Spacer` with no axis is a zero-sized, no-effect
 *   primitive — useless. Forcing the consumer to declare
 *   the axis makes the intent explicit. The three-axis
 *   union (`'horizontal' | 'vertical' | 'both'`) covers
 *   every legitimate use case; rare cases like
 *   "horizontal only when room" are expressed by passing
 *   `axis: 'horizontal'` and letting the flex layout do
 *   the rest.
 *
 * Why `size` defaults to `'none'`:
 *   The minimum size is the spacer's *baseline* — the
 *   space it always claims regardless of container size.
 *   `'none'` (zero) is the right default: a `Spacer`
 *   with zero base size is a pure flex-grow item, which
 *   is the most common use. Consumers that want a
 *   minimum (e.g. a 16px gap before the footer) pass
 *   `size: 'md'` explicitly.
 */

import type { Theme } from '../../theme/types';
import type { PaddingStep, SpacerAxis } from './types';
import type { ResolvedSpacer } from './resolved';

/* ============================================================
 * Prop contract
 * ========================================================== */

/**
 * `Spacer` prop contract.
 *
 * `size` is the *minimum* size; the spacer grows beyond
 * it when siblings leave leftover space. The size is
 * resolved through `theme.spacing` — the same vocabulary
 * `padding` and `gap` use, because size is also a
 * spacing-scale-measurable value.
 *
 * `axis` is the direction the spacer grows:
 *   - `'horizontal'` — the spacer grows on the X axis
 *     (left-to-right within a `row` flex container).
 *   - `'vertical'` — the spacer grows on the Y axis
 *     (top-to-bottom within a `column` flex container).
 *   - `'both'` — the spacer grows in both directions
 *     (rare; useful when the spacer is the only child of
 *     a container that needs to fill).
 *
 * `theme` is required for the same reason as on `Box` —
 * the resolver needs the theme to look up the size.
 */
export interface SpacerProps {
  /**
   * The growth axis. Required — see the file header for
   * the rationale.
   */
  readonly axis: SpacerAxis;

  /**
   * The minimum size, expressed as a spacing step. The
   * resolver reads `theme.spacing[size]` to get a pixel
   * value. Default: `'none'` (zero-pixel baseline).
   */
  readonly size?: PaddingStep;

  /** The active theme — required. */
  readonly theme: Theme;
}

/* ============================================================
 * Resolver
 * ========================================================== */

/**
 * Resolve a `Spacer` to its rendered shape.
 *
 * The resolver reads the size step from the spacing
 * scale (treating `'none'` as zero) and passes through
 * the axis. The returned shape has no surface, no
 * padding, no border — a `Spacer` is an empty region
 * whose only contract is its size and axis.
 *
 * The adapter turns the resolved shape into a flex item
 * with `{ flex: 1, [axis]: baseSize }` (or its CSS
 * equivalent). The spacer grows on its axis; on the
 * cross axis it has zero size unless the container's
 * cross-axis alignment makes it stretch.
 */
export function resolveSpacer(props: SpacerProps): ResolvedSpacer {
  const { theme } = props;

  return Object.freeze({
    axis: props.axis,
    baseSize: resolveSize(props.size, theme),
  });
}

/**
 * Resolve a size step. Same logic as the padding /
 * gap resolvers — the type is the same, the meaning is
 * the same.
 */
function resolveSize(prop: PaddingStep | undefined, theme: Theme): number {
  if (prop === 'none' || prop === undefined) return 0;
  return theme.spacing[prop];
}