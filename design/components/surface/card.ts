/**
 * `Card` — a composite surface primitive for elevated content.
 *
 * `Card` is `Surface` plus a single piece of consumer-facing
 * metadata: a *variant* (the visual treatment the consumer
 * chooses). The variant is not a styling override — it is a
 * named profile that resolves to a specific combination of
 * surface, border, and elevation.
 *
 * Why `Card` composes `Surface` rather than re-declaring the
 * visual contract:
 *   `Card` is `Surface` plus one field. Re-declaring the
 *   surface-and-palette lookup here would mean *two* places
 *   to keep in lock-step — a future change to the role-
 *   resolution logic would have to land in both. Composing
 *   through `resolveSurface` keeps the visual logic in one
 *   place, and `Card` adds only the variant metadata.
 *
 *   The composition is the same shape as `Heading` extending
 *   `Text` (Phase 2.4.2), `Flex` extending `Box` (Phase
 *   2.4.1), and `Stack` extending `Flex` — a shallow
 *   composition that adds exactly the new field.
 *
 * Why `Card` is a primitive and not a styled `Surface`:
 *   `Card` carries *semantic* information that `Surface`
 *   does not. A `Surface` is a visual container; a `Card`
 *   is a content container with a defined visual identity
 *   (a variant). The variant choice is a design decision —
 *   "this card is the resting default" vs "this card is
 *   elevated" vs "this card is filled" — and the resolver
 *   translates the decision into a specific (surface, border,
 *   elevation) combination. The variant vocabulary is the
 *   contract; the combination is the implementation.
 *
 * Variant resolution:
 *   `Card` accepts a `variant` prop typed as `CardVariant`
 *   (`'default' | 'outlined' | 'elevated' | 'filled'`). The
 *   resolver maps the variant to a (surface, border,
 *   elevation) tuple through a hand-coded switch, then
 *   delegates to `resolveSurface` with the resolved tuple
 *   plus the consumer's override props.
 *
 *   The mapping is:
 *
 *     `'default'`   → `surface: 'card'`,   `border: 'subtle'`,   `elevation: 'sm'`
 *     `'outlined'`  → `surface: 'card'`,   `border: 'default'`,  `elevation: 'none'`
 *     `'elevated'`  → `surface: 'card'`,   `border: 'none'`,     `elevation: 'md'`
 *     `'filled'`    → `surface: 'elevated'`, `border: 'none'`,   `elevation: 'none'`
 *
 *   The mapping is the role-layer decision — what each
 *   variant *means* in the design language. A future
 *   fifth variant (`'ghost'`?) lands as a one-line
 *   addition to the union and the switch.
 *
 * Why the variant mapping is hand-coded and not derived:
 *   The variant vocabulary is a *consumer* choice — what a
 *   designer or developer authoring a card reaches for. The
 *   mapping from variant to (surface, border, elevation)
 *   encodes design intent that *no* theme-level role exposes
 *   today. Putting the mapping in the resolver (rather than
 *   in the role layer) keeps the role layer theme-independent
 *   (the same role applies in light and dark) and the
 *   variant mapping locally scoped (each variant is a
 *   named decision, not a theme-level fact).
 *
 * Override precedence:
 *   A consumer that wants to override the variant's defaults
 *   passes `padding`, `radius`, `elevation`, or `border`
 *   explicitly. The overrides win over the variant's
 *   defaults — same pattern as `Surface`. The variant stays
 *   a named profile; the overrides are escape hatches.
 */

import type { Theme } from '../../theme/types';
import type {
  CardVariant,
  LandmarkRole,
  BorderLevelKey,
  ElevationLevelKey,
} from './types';
import type { ResolvedCard } from './resolved';
import { resolveSurface } from './surface';
import type { PaddingStep } from '../layout/types';
import type { RadiusStepKey } from '../layout/types';

/* ============================================================
 * Prop contract
 * ========================================================== */

/**
 * The `Card` prop contract.
 *
 * `variant` is optional — the default is `'default'`, the
 * resting card. A consumer that wants a different variant
 * passes it explicitly. The variant-to-(surface, border,
 * elevation) mapping is the resolver's responsibility; the
 * prop contract is the consumer's interface.
 *
 * The other fields (`padding`, `radius`, `elevation`,
 * `border`, `landmark`) flow through `Surface` unchanged,
 * with the resolver applying the variant's defaults first
 * and the override props winning when set.
 *
 * `id` is the card's optional identifier — passed through
 * to the resolved shape, and forwarded to the adapter as
 * the DOM id on web and the `testID` on RN. A consumer
 * that needs a stable handle (an integration test, a
 * screen-reader stop) sets `id` explicitly.
 */
export interface CardProps {
  /**
   * The card's visual variant — the named profile the
   * consumer chooses.
   *
   * Default: `'default'` — the resting card, the most
   * common variant. A consumer that wants a different
   * variant passes it explicitly.
   */
  readonly variant?: CardVariant;

  /**
   * The card's identifier, if any. The adapter forwards
   * this as the DOM id on web and the `testID` on RN.
   *
   * Optional: a card that does not need a stable handle
   * does not need an id.
   */
  readonly id?: string;

  /**
   * Override the variant's padding. Same semantics as on
   * `Surface`. If unset, the variant's default padding
   * wins (the surface role's natural padding).
   */
  readonly padding?: PaddingStep;

  /**
   * Override the variant's corner radius. Same semantics
   * as on `Surface`.
   */
  readonly radius?: RadiusStepKey;

  /**
   * Override the variant's elevation level. Same semantics
   * as on `Surface`.
   */
  readonly elevation?: ElevationLevelKey;

  /**
   * Override the variant's border level. Same semantics
   * as on `Surface`.
   */
  readonly border?: BorderLevelKey;

  /**
   * The accessibility landmark role. Same semantics as
   * on `Surface`. Default: `'landmark'` — the non-semantic
   * role.
   */
  readonly landmark?: LandmarkRole;

  /** The active theme — required. */
  readonly theme: Theme;
}

/* ============================================================
 * Resolver
 * ========================================================== */

/**
 * Resolve a `Card` to its rendered shape.
 *
 * The resolver composes `resolveSurface` (which composes
 * the surface-and-palette lookup) and adds the variant
 * metadata. The variant-to-(surface, border, elevation)
 * mapping is a hand-coded switch; the resolver passes
 * the resolved defaults to `resolveSurface` along with
 * any override props the consumer set.
 *
 * Why the variant's defaults are passed as overrides to
 * `resolveSurface`:
 *   `resolveSurface` accepts `surface` / `border` /
 *   `elevation` props and applies them with the same
 *   precedence pattern (override-prop wins over surface-
 *   role default). Passing the variant's defaults as the
 *   *override* props means the consumer's `padding` /
 *   `radius` / `border` / `elevation` overrides still
 *   win over the variant's defaults — the precedence is
 *   `consumer override > variant default > surface role`,
 *   in that order.
 *
 * Why `variant` is resolved first, before any other prop:
 *   Every other resolution depends on the variant's
 *   defaults. The variant chooses the surface, border, and
 *   elevation; the resolver applies those choices as the
 *   baseline, then layers the consumer's overrides on top.
 *   Resolving the variant second would lose the
 *   precedence chain.
 */
export function resolveCard(props: CardProps): ResolvedCard {
  // Resolve the variant to its (surface, border, elevation)
  // defaults. The mapping is a hand-coded switch — see
  // the file header for the rationale.
  const variant: CardVariant = props.variant ?? 'default';
  const defaults = resolveVariant(variant);

  // Compose the visual resolution through `Surface`. The
  // variant's defaults are passed as props; the consumer's
  // `padding` / `radius` / `elevation` / `border` overrides
  // win over the variant's defaults. The `landmark` prop
  // flows through unchanged. Optional props are conditionally
  // spread — `exactOptionalPropertyTypes` rejects explicit
  // `undefined` against an optional field, so we omit the
  // field entirely when the consumer did not set it.
  const surface = resolveSurface({
    surface: defaults.surface,
    border: props.border ?? defaults.border,
    elevation: props.elevation ?? defaults.elevation,
    ...(props.padding !== undefined && { padding: props.padding }),
    ...(props.radius !== undefined && { radius: props.radius }),
    ...(props.landmark !== undefined && { landmark: props.landmark }),
    theme: props.theme,
  });

  // The variant field is independent of the visual
  // resolution — metadata, not visual styling. The
  // resolver carries it through unchanged.
  if (props.id !== undefined) {
    return Object.freeze({
      ...surface,
      variant,
      id: props.id,
    });
  }

  return Object.freeze({
    ...surface,
    variant,
  });
}

/* ============================================================
 * Internal helpers
 * ========================================================== */

/**
 * Map a `CardVariant` to its (surface, border, elevation)
 * defaults. The map is a hand-coded constant — see the
 * file header for the rationale.
 *
 * The resolved defaults are the *baseline* the consumer's
 * override props win over. A consumer that wants a
 * `'default'` card with no shadow passes `elevation: 'none'`
 * explicitly; the variant default is `elevation: 'sm'` and
 * the override drops the shadow.
 */
function resolveVariant(variant: CardVariant): {
  readonly surface: 'page' | 'card' | 'elevated' | 'overlay';
  readonly border: BorderLevelKey;
  readonly elevation: ElevationLevelKey;
} {
  switch (variant) {
    case 'default':
      return {
        surface: 'card',
        border: 'subtle',
        elevation: 'sm',
      };
    case 'outlined':
      return {
        surface: 'card',
        border: 'default',
        elevation: 'none',
      };
    case 'elevated':
      return {
        surface: 'card',
        border: 'none',
        elevation: 'md',
      };
    case 'filled':
      return {
        surface: 'elevated',
        border: 'none',
        elevation: 'none',
      };
  }
}