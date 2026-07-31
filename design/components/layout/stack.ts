/**
 * `Stack` — a `Flex` specialised for vertical / horizontal
 * stacking with a gap.
 *
 * `Stack` is the most-used layout primitive in the design
 * after `Box`. A card with three sections stacked top-to-
 * bottom is a `Stack`. A toolbar with three buttons side-by-
 * side is a `Stack`. The prop set is narrower than `Flex`'s
 * because the most common case is a single-axis layout with
 * a gap — anything more elaborate is a `Flex` consumer.
 *
 * Composition:
 *   `StackProps` extends `FlexProps` (and through it, `BoxProps`).
 *   The resolver composes `resolveFlex` (which composes
 *   `resolveBox`). Three layers deep, each a five-line
 *   composition; the surface, padding, and other `Box` fields
 *   are inherited transparently.
 *
 * Why `direction` is narrowed to `'row' | 'column'` instead
 * of the full `FlexDirection`:
 *   Reverse directions are a `Flex` concern, not a `Stack`
 *   one. A stack that reads top-to-bottom is `column`; a
 *   stack that reads left-to-right is `row`. The reverse
 *   variants are rare and better expressed as a `Flex`. The
 *   narrower union pushes the right primitive to the right
 *   consumer.
 *
 * Why `gap` is *required* and not defaulted:
 *   A `Stack` without a gap is a `Flex` with no wrap. The
 *   narrow contract forces a consumer to declare the gap
 *   explicitly, which is the design-system-wide invariant
 *   that gaps are always intentional. A future `gap` default
 *   is a one-line prop change; until then, the required
 *   prop is the contract that keeps stacks visually
 *   consistent.
 *
 *   (The default-to-`'none'` variant is a future `Stack`
 *   rename — `Cluster` or `Row` — for the no-gap case. Today's
 *   `Stack` is gap-aware.)
 */

import type { FlexProps } from './flex';
import { resolveFlex } from './flex';
import type { FlexAlign, PaddingStep } from './types';
import type { ResolvedFlex } from './resolved';
import type { ResolvedBox } from './resolved-box';

/* ============================================================
 * Prop contract
 * ========================================================== */

/**
 * A narrower `FlexDirection` — the two non-reverse variants.
 * Documented in `stack.ts`'s file header.
 */
export type StackDirection = 'row' | 'column';

/**
 * `Stack` prop contract. Extends `FlexProps` so a `Stack`
 * receives every `Box` and `Flex` field plus the two
 * stack-specific fields (`direction`, `gap`).
 *
 * `direction` is required — see the file header for the
 * rationale. `align` is optional; the default (`'stretch'`)
 * matches `Flex`'s default.
 */
export interface StackProps extends FlexProps {
  /** The stack direction. Required. */
  readonly direction: StackDirection;

  /**
   * The gap between children. Required — a `Stack` is
   * defined by its gap.
   */
  readonly gap: PaddingStep;

  /**
   * The cross-axis alignment. Optional — defaults to
   * `'stretch'`, matching `Flex`'s default.
   */
  readonly align?: FlexAlign;
}

/* ============================================================
 * Resolver
 * ========================================================== */

/**
 * Resolve a `Stack` to its rendered shape.
 *
 * The resolver composes `resolveFlex` and rewrites the
 * `direction` field — the consumer's `direction` is
 * passed through unchanged, but the resolver goes
 * through `Flex` so the inheritance chain is clear.
 *
 * `direction` and `gap` are required props, so the
 * resolver does not need defaults. The absence of a
 * default keeps the contract narrow.
 */
export function resolveStack(props: StackProps): ResolvedFlex & ResolvedBox {
  return resolveFlex({
    ...props,
    direction: props.direction,
    gap: props.gap,
  });
}

/**
 * Re-export `FlexProps` and `resolveFlex` from this module
 * so a consumer that imports `Stack` and uses the full
 * `Flex` API reaches one place for the types.
 *
 * `Theme` is re-exported from this module so a consumer
 * that uses `Stack` in a prop type can declare the
 * `theme` field without a separate import.
 */
export type { FlexProps } from './flex';
export type { Theme } from '../../theme/types';
