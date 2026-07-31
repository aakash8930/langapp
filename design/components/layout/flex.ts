/**
 * `Flex` — a flex container built on `Box`.
 *
 * `Flex` is `Box` plus flex direction, alignment, justification,
 * wrap, and gap. It is the second layer of the layout
 * pyramid: every consumer that arranges children in a row
 * or column reaches for `Flex` first, then specialises with
 * `Stack`.
 *
 * Composition over inheritance:
 *   `FlexProps` extends `BoxProps` rather than re-declaring
 *   the surface fields. The two are not "related by a base
 *   class" — they are related by inclusion: a `Flex` *is*
 *   a `Box` with extra properties. TypeScript's interface
 *   extension is the right tool for that relationship.
 *
 *   A `Stack` is a `Flex` specialised, and the same
 *   extension pattern applies. The pyramid becomes:
 *     `Box` (no layout)
 *     `Flex` extends `Box` (adds layout)
 *     `Stack` extends `Flex` (adds gap + axis narrowing)
 *
 *   Every level is one shallow composition, not a deep
 *   re-implementation.
 *
 * Why `Flex` does not fold `gap` into `padding`:
 *   `padding` is the *internal* space at the container's
 *   edges; `gap` is the *external* space between children.
 *   They are different design decisions: a card with
 *   `padding: 'md'` and no children has padding; a flex
 *   container with `gap: 'md'` and no padding has only
 *   gaps between children. The two are independently
 *   settable because they mean different things.
 *
 * Why `gap` is a single value and not a `gapX` / `gapY`
 * tuple in this phase:
 *   The current design uses a single gap per container.
 *   Asymmetric gaps (more vertical, less horizontal) are
 *   rare and a future addition — a `gapX` / `gapY` split,
 *   not a contract change. Today's `Flex` reads the same
 *   gap on both axes, matching the role layer's design
 *   assumption.
 */

import type { BoxProps } from './box';
import { resolveBox } from './box';
import type { Theme } from '../../theme/types';
import type {
  FlexDirection,
  FlexAlign,
  FlexJustify,
  FlexWrap,
  PaddingStep,
} from './types';
import type { ResolvedFlex } from './resolved';
import type { ResolvedBox } from './resolved-box';

/* ============================================================
 * Prop contract
 * ========================================================== */

/**
 * `Flex` prop contract. Extends `BoxProps` so a `Flex`
 * receives every `Box` field (surface, padding, radius,
 * elevation, border) plus the five flex-specific fields.
 *
 * Default behaviour:
 *   - `direction` defaults to `'row'` — the western
 *     reading order, the most common layout.
 *   - `align` defaults to `'stretch'` — children fill
 *     the cross axis, the most common alignment.
 *   - `justify` defaults to `'start'` — children pack
 *     at the start of the main axis.
 *   - `wrap` defaults to `'nowrap'` — children do not
 *     wrap, the most common layout.
 *   - `gap` defaults to `'none'` — no gap between
 *     children.
 *
 *   The defaults are the strongest signal of the design's
 *   default layout. A consumer that needs a different
 *   default set should pass the prop explicitly rather
 *   than rely on the implicit default.
 */
export interface FlexProps extends BoxProps {
  /** The flex direction. */
  readonly direction?: FlexDirection;

  /** The cross-axis alignment. */
  readonly align?: FlexAlign;

  /** The main-axis justification. */
  readonly justify?: FlexJustify;

  /** The wrap behaviour. */
  readonly wrap?: FlexWrap;

  /**
   * The gap between children. A `PaddingStep` resolves
   * against `theme.spacing`; `'none'` is the explicit
   * zero-gap sentinel.
   *
   * The same `PaddingStep` type is used for `gap` and
   * for `padding` because both are spacing-scale-
   * measurable values. The contextual name is the only
   * difference — the type is the same.
   */
  readonly gap?: PaddingStep;
}

/* ============================================================
 * Resolver
 * ========================================================== */

/**
 * Resolve a `Flex` to its rendered shape.
 *
 * The resolver composes two halves:
 *   1. `resolveBox` — surfaces the `Box` half (background,
 *      elevation, radius, padding, border).
 *   2. The flex-specific resolution — direction, alignment,
 *      justification, wrap, gap.
 *
 * The returned shape is a `ResolvedFlex & ResolvedBox` — the
 * flex fields and the box fields are siblings, not nested.
 * The adapter spreads the fields into a single style object.
 *
 * Why `resolveBox` is called here rather than re-implemented:
 *   Surface resolution is `Box`'s job. A `Flex` is a
 *   `Box` that adds flex fields; the resolver composes
 *   the two without duplicating the surface logic. A future
 *   `Stack` resolver calls `resolveFlex` (which calls
 *   `resolveBox`) — three layers deep, each a five-line
 *   composition.
 */
export function resolveFlex(props: FlexProps): ResolvedFlex & ResolvedBox {
  const box: ResolvedBox = resolveBox(props);

  const flex: ResolvedFlex = Object.freeze({
    direction: props.direction ?? 'row',
    align: props.align ?? 'stretch',
    justify: props.justify ?? 'start',
    wrap: props.wrap ?? 'nowrap',
    gap: resolveGap(props.gap, props.theme),
  });

  return Object.freeze({
    ...box,
    ...flex,
  });
}

/**
 * Resolve a gap step. Same logic as `resolvePaddingStep`
 * in `box.ts` — the type is the same, the meaning is the
 * same (a numeric pixel value), only the consumer-facing
 * name differs.
 *
 * Internal helper, not exported. A consumer that needs a
 * pixel-from-step helper imports the role layer directly.
 */
function resolveGap(
  prop: PaddingStep | undefined,
  theme: Theme,
): number {
  if (prop === 'none' || prop === undefined) return 0;
  return theme.spacing[prop];
}
