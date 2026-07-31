/**
 * `Box` — resolved shape.
 *
 * The composition of `ResolvedSurface` (background, elevation,
 * radius, padding) and a nullable `ResolvedBorder`. The
 * fields are deliberately flat — `Box` is the most-used
 * layout primitive, and a flat resolved shape lets the
 * adapter spread its fields into a single style object
 * without further nesting.
 *
 * Why `border` is nullable and not optional:
 *   `ResolvedBox.border` is `ResolvedBorder | null`. The
 *   `null` case is the "no border" outcome — a `Box` with
 *   no `border` prop or with `border: 'none'` resolves to
 *   `border: null`. An optional field (`border?`) would
 *   lose the distinction between "unset" and "explicitly
 *   none", which is the same distinction in result but
 *   different in intent. The `null` form is explicit.
 *
 * Why `padding` is a single `number` and not a tuple:
 *   The role layer's `SurfaceRole.padding` is a single
 *   value — the role's natural internal padding. A `Box`
 *   that needs asymmetric padding receives a future
 *   `paddingX` / `paddingY` split, which is a separate
 *   contract evolution. Today's `Box` reads the same
 *   value on all four sides for symmetry with the role.
 */

import type { ResolvedBorder } from './resolved';
import type { ResolvedSurface } from './resolved';

export interface ResolvedBox extends ResolvedSurface {
  /**
   * The resolved border. `null` when the consumer did not
   * pass a `border` prop (or passed `border: 'none'`).
   */
  readonly border: ResolvedBorder | null;
}
