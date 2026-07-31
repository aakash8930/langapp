/**
 * `Divider` — a semantic separator.
 *
 * `Divider` draws a thin line that separates two regions
 * of a layout. A horizontal divider sits between two
 * cards; a vertical divider sits between a navigation
 * rail and the main content.
 *
 * Why `Divider` is a primitive and not a styled `Box`:
 *   A divider's contract is *narrow* — orientation,
 *   colour, thickness — and not the contract `Box`
 *   carries. A divider has no padding, no elevation, no
 *   children. A `Divider` extending `Box` would inherit
 *   ten props a divider never uses. A standalone
 *   primitive keeps the contract small.
 *
 * Why `border` is a level and not a colour:
 *   The design uses the *border* scale for divider lines
 *   — `border.subtle` for a hairline, `border.default`
 *   for a present line, `border.strong` for an emphasis
 *   line. Reading the existing border scale keeps the
 *   vocabulary consistent: a divider is "a border, but
 *   on its own as a separator".
 *
 *   The five border levels (`none | subtle | default |
 *   strong | focus`) apply identically. `none` is the
 *   "no divider" sentinel; `subtle` is the most common
 *   (a hairline); `focus` is a rare emphasis divider
 *   used on focused regions.
 *
 * Why orientation is required:
 *   A divider with no orientation is a zero-size, no-
 *   effect primitive. Forcing the consumer to declare
 *   the orientation makes the intent explicit. Both
 *   `'horizontal'` and `'vertical'` are valid in any
 *   container that supports flex direction — a
 *   horizontal divider in a row container is a vertical
 *   line that flexes to its axis.
 *
 * Why `thickness` is not exposed in this phase:
 *   The current design uses only `1px` and `2px` lines
 *   (a hairline and a focus ring). The `border.width.*`
 *   primitive scale is a future addition (Phase 2.2's
 *   roadmap); until it lands, the resolver hard-codes
 *   the thickness to `1` for the common levels and `2`
 *   for `focus`. A consumer that needs a different
 *   thickness today has no escape hatch — the design
 *   does not author one. The brief's "no feature-
 *   specific components" rule applies: thickness is
 *   not a per-consumer choice.
 */

import type { Theme } from '../../theme/types';
import type { BorderLevelKey, DividerOrientation } from './types';
import type { ResolvedDivider } from './resolved';

/* ============================================================
 * Prop contract
 * ========================================================== */

/**
 * `Divider` prop contract.
 *
 * `orientation` is required; `border` defaults to
 * `'subtle'` — the most common divider level, a
 * hairline. The default makes `<Divider />` (no props)
 * a valid call that draws a hairline; the resolver
 * chooses the orientation-aware thickness and colour.
 *
 * `theme` is required for the same reason as on
 * `Box` — the resolver needs the theme to look up the
 * divider's colour through the border scale.
 */
export interface DividerProps {
  /** The divider's orientation — required. */
  readonly orientation: DividerOrientation;

  /**
   * The border level. Defaults to `'subtle'` — the
   * hairline level, the most common divider.
   */
  readonly border?: BorderLevelKey;

  /** The active theme — required. */
  readonly theme: Theme;
}

/* ============================================================
 * Resolver
 * ========================================================== */

/**
 * Resolve a `Divider` to its rendered shape.
 *
 * The resolver:
 *   1. Reads the border level (`'subtle'`, `'default'`,
 *      `'strong'`, `'focus'`, or `'none'`).
 *   2. Resolves the level's colour through the palette's
 *      `border.*` group (same mapping as `Box.resolveBorder`).
 *   3. Resolves the thickness — `1` for the common levels,
 *      `2` for `focus`.
 *
 * The resolved shape carries only the fields a divider
 * needs: orientation, colour, thickness. No padding, no
 * elevation, no border-level field (the level was the
 * input, not the output — the adapter receives the
 * resolved colour and thickness, not the level name).
 *
 * A `'none'` divider resolves to a fully-transparent,
 * zero-thickness line — semantically equivalent to a
 * spacer of zero size. The adapter renders it as a
 * zero-pixel element; the audit step catches accidental
 * "no divider" renderings if the consumer chose `'none'`
 * when they meant `'subtle'`.
 */
export function resolveDivider(props: DividerProps): ResolvedDivider {
  const level = props.border ?? 'subtle';

  // 'none' resolves to an empty, zero-thickness line.
  // The adapter treats this as a render-skip; the audit
  // step flags a consumer that uses it.
  if (level === 'none') {
    return Object.freeze({
      orientation: props.orientation,
      color: '',
      thickness: 0,
    });
  }

  const color = resolveBorderColor(level, props.theme);
  const thickness = resolveThickness(level);

  return Object.freeze({
    orientation: props.orientation,
    color,
    thickness,
  });
}

/**
 * Map a border level to the palette's `border.*` colour
 * key. Same mapping as `Box.resolveBorder` — the two
 * resolvers agree on which level reads which colour. The
 * function is duplicated rather than shared because
 * `Box.resolveBorder` returns a richer shape (level +
 * colour + width) and `Divider.resolveDivider` returns
 * only the colour; sharing would force one resolver to
 * discard the other's fields.
 */
function resolveBorderColor(level: BorderLevelKey, theme: Theme): string {
  let colorKey: string;
  switch (level) {
    case 'subtle':
      colorKey = 'subtle';
      break;
    case 'default':
      colorKey = 'border';
      break;
    case 'strong':
      colorKey = 'borderStrong';
      break;
    case 'focus':
      colorKey = 'borderFocus';
      break;
    case 'none':
      return '';
  }

  // The palette's `border.*` group is keyed by the four
  // colour names. The resolver joins the prefix and the
  // key name with a dot.
  const groupValue = (theme.colors as unknown as Record<string, Record<string, string>>)
    .border;
  if (groupValue === undefined) return '';
  const slotValue = groupValue[colorKey];
  return slotValue ?? '';
}

/**
 * Resolve a thickness in pixels. Same mapping as
 * `Box.resolveBorder`'s width — `1` for the common
 * levels, `2` for `focus`. The mapping is duplicated
 * for the same reason as `resolveBorderColor` above.
 */
function resolveThickness(level: BorderLevelKey): number {
  if (level === 'focus') return 2;
  return 1;
}