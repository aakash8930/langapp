/**
 * `Surface` — the visual foundation of the design system.
 *
 * `Surface` is the primitive every other surface primitive
 * builds on. It answers one design question: "what does the
 * container look like?" — a background colour, a border, a
 * corner radius, an elevation, and an internal padding.
 *
 * Why `Surface` is the visual foundation:
 *   Every consumer that needs a styled container (Card, Modal,
 *   Popover, List Item, Navigation Item, Button, Input, etc.)
 *   is, at the visual layer, a `Surface` with metadata. The
 *   metadata differs (a card adds a variant, a modal adds a
 *   landmark, a button adds state); the visual layer is the
 *   same. Building `Surface` first means every later surface
 *   primitive is a shallow composition, not a re-implementation
 *   of background + border + elevation.
 *
 * Why `Surface` is separate from `Box` (Phase 2.4.1's layout
 * primitive):
 *   `Box` is a *layout* primitive — it answers "how are
 *   children arranged?" and incidentally exposes a surface.
 *   `Surface` is a *visual* primitive — it answers "what does
 *   the container look like?" and does not know about
 *   children. The two are orthogonal: a `Card` composes
 *   `Surface` for its visual treatment; a future `Flex` might
 *   accept a `surface` prop to visualise itself, but it is
 *   the surface treatment on a layout primitive, not a
 *   visual primitive that knows about layout.
 *
 *   Conflating the two would force every layout primitive to
 *   carry the surface contract (and the border / elevation
 *   resolution), and every visual primitive to carry the
 *   layout contract (and the flex / gap / padding-for-
 *   spacing). The two halves stay separate, and a
 *   future `Card` composes `Surface` + `Box` (or just
 *   `Surface` with internal padding) — the consumer-facing
 *   primitive does the composition.
 *
 * Surface resolution:
 *   `Surface` accepts a `surface` prop typed as `SurfaceKey`
 *   (`'page' | 'card' | 'elevated' | 'overlay'`). The
 *   resolver reads `theme.roles.surface[surface]` and uses
 *   its `background`, `elevation`, `padding`, and `radius`
 *   to drive the resolved shape.
 *
 *   A consumer that wants a different surface from the
 *   default can override any of the four fields:
 *   `padding`, `radius`, `elevation`, `border`. The override
 *   precedence is documented on the prop descriptions below.
 *
 * Border resolution:
 *   `Surface` accepts a `border` prop typed as
 *   `BorderLevelKey`. The resolver reads
 *   `theme.roles.border[border]` and resolves the level's
 *   colour through the palette's `border.*` group, and
 *   the width through the border-level metadata. The
 *   mapping is the same as Phase 2.4.1's `Box.resolveBorder`
 *   — the two resolvers agree on what a border is.
 *
 * Why `Surface` does not accept a raw `string` background:
 *   A `background: '#FF0000'` would bypass the token system
 *   and reintroduce the kind of drift Phase 2.1 promised to
 *   prevent. The rule "components consume semantic roles,
 *   never primitive tokens" applies uniformly — the only
 *   way to get a colour into a `Surface` is through the
 *   role layer or the border layer, which are the
 *   change-control gates.
 *
 * Landmark resolution:
 *   `Surface` accepts a `landmark` prop typed as
 *   `LandmarkRole`. The resolver carries the role through
 *   to the resolved shape; the adapter translates it into
 *   the platform's accessibility attribute (HTML element
 *   role, RN `accessibilityRole`). The default is
 *   `'landmark'` — the non-semantic role.
 *
 * Why every surface carries a landmark role:
 *   Every surface eventually renders to a platform element
 *   that has an accessibility role. The role is *metadata*
 *   the resolver passes through, not a runtime computation.
 *   A `Surface` that should render as a `<section>`, a
 *   `<article>`, or a presentational element declares the
 *   landmark at the call site; the resolver carries it
 *   through, and the adapter translates it.
 *
 * Immutability:
 *   The resolver returns a `ResolvedSurface` whose fields
 *   are all `readonly`. The prop contract is also readonly.
 *   A future runtime cannot mutate a resolved `Surface`
 *   after the resolver returns.
 */

import type { Theme } from '../../theme/types';
import type { Roles } from '../../theme/roles.types';
import type { ResolvedBorder } from '../layout/resolved';
import type {
  SurfaceKey,
  BorderLevelKey,
  ElevationLevelKey,
  LandmarkRole,
} from './types';
import type { ResolvedSurfaceVisual } from './resolved';

/* ============================================================
 * Prop contract
 * ========================================================== */

/**
 * The `Surface` prop contract.
 *
 * Field precedence (highest wins):
 *   1. The explicit `padding` / `radius` / `elevation` /
 *      `border` props override the matching field on the
 *      surface role.
 *   2. If `surface` is unset, the four fields resolve to
 *      the page surface's no-op values — a `Surface` with
 *      no surface is a transparent page container.
 *
 * Why the precedence is *role-then-override*, not *override-
 * then-role*:
 *   Designers think surface-first. A "card" is a card unless
 *   I say otherwise. The override pattern lets a consumer
 *   reach for a card's surface and tweak one field without
 *   re-declaring the rest.
 *
 * Why `landmark` is on `Surface` and not on a higher-level
 * primitive:
 *   Every surface element eventually renders to a platform
 *   element with an accessibility role. Putting the field
 *   on `Surface` means `Card` and `Container` inherit it
 *   for free (they compose `Surface`); a future `Modal`
 *   that needs `'region'` sets it on the composed `Surface`.
 *   The field is *metadata only* — the resolver does not
 *   synthesise platform attributes.
 */
export interface SurfaceProps {
  /**
   * The surface role this `Surface` adopts. Resolves through
   * `theme.roles.surface[surface]` to set the background,
   * elevation, padding, and radius in one read.
   *
   * Default: `'page'` — the resting page surface, so a
   * `Surface` with no surface prop is a transparent page
   * background. A consumer that wants a different surface
   * passes it explicitly.
   */
  readonly surface?: SurfaceKey;

  /**
   * Override the surface role's padding. Accepts a padding
   * step (`'none' | '3xs' | '2xs' | 'xs' | 'sm' | 'md' | 'lg' |
   * 'xl' | '2xl' | '3xl' | '4xl' | '5xl'`) that resolves
   * against the spacing scale.
   *
   * `'none'` is the explicit zero-padding sentinel.
   */
  readonly padding?: import('../layout/types').PaddingStep;

  /**
   * Override the surface role's corner radius. Accepts a
   * radius step (`'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' |
   * 'full'`) that resolves against the radius scale.
   *
   * `'none'` is the hard-edge sentinel; `'full'` is the
   * pill / circle sentinel.
   */
  readonly radius?: import('../layout/types').RadiusStepKey;

  /**
   * The elevation level. Accepts any of the six elevation
   * levels (`'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl'`).
   * If both `surface` and `elevation` are set, `elevation`
   * overrides the surface role's elevation field.
   *
   * Default: `undefined` — the resolver reads the surface
   * role's elevation. Setting `elevation: 'none'` explicitly
   * is the way to opt a card out of its shadow without
   * changing the surface.
   */
  readonly elevation?: ElevationLevelKey;

  /**
   * The border level. Accepts any of the five border
   * levels (`'none' | 'subtle' | 'default' | 'strong' |
   * 'focus'`).
   *
   * Default: `undefined` — the resolver produces no border.
   * Setting `border: 'subtle'` adds a hairline edge on top
   * of the surface background.
   */
  readonly border?: BorderLevelKey;

  /**
   * The accessibility landmark role. The resolver carries
   * the role through to the resolved shape; the adapter
   * translates it into the platform's accessibility attribute
   * (HTML element role, RN `accessibilityRole`).
   *
   * Default: `'landmark'` — the non-semantic role.
   */
  readonly landmark?: LandmarkRole;

  /**
   * The theme reference. The resolver needs the theme to
   * read the role layer and the palette. A theme-typed
   * prop on the contract makes the resolver testable
   * without a global Theme; a future test calls
   * `resolveSurface({ surface: 'card' }, lightTheme)`
   * directly.
   */
  readonly theme: Theme;
}

/* ============================================================
 * Resolver
 * ========================================================== */

/**
 * Resolve a `Surface` to its rendered shape.
 *
 * The resolver is a pure function — it takes the props and
 * the active theme, and returns a `ResolvedSurfaceVisual`
 * that a future platform adapter translates into a real
 * CSS element or RN `View`. No side effects, no React, no
 * platform code.
 *
 * Resolution order:
 *   1. Resolve `surface` against `theme.roles.surface`. If
 *      unset, fall back to `theme.roles.surface.page`.
 *   2. Resolve the surface's `background` path string
 *      against `theme.colors`. The path string
 *      (`'bg.surface'`) becomes a keyed lookup; the resolved
 *      value is a hex string.
 *   3. Apply the override precedence: a `padding` / `radius`
 *      / `elevation` prop replaces the surface role's
 *      matching field; a `border` prop adds a border on top.
 *   4. Resolve the props' step keys through the matching
 *      primitive scale.
 *   5. Resolve the border's colour through the palette's
 *      `border.*` group.
 *   6. Carry the `landmark` role through unchanged.
 *
 * Why `resolveSurface` is exported as the *single* surface
 * resolver that `Card` and `Container` compose:
 *   The role-and-palette lookup is the same logic for every
 *   surface primitive. Duplicating it across three resolvers
 *   would mean three places to keep in lock-step. A future
 *   change to the role-lookup pattern (a new path segment,
 *   a new group) would have to land in all three. Composing
 *   through `resolveSurface` keeps the lookup in one place,
 *   and `Card` / `Container` add only their unique metadata
 *   (variant, width, padding profile).
 *
 * Why `Surface` does not import `Box`'s resolver:
 *   The two resolvers are *siblings*, not parent-child. `Box`
 *   is a layout primitive that incidentally exposes a
 *   surface; `Surface` is a visual primitive that does not
 *   know about layout. The two share the same role-and-
 *   palette lookup pattern, but they live in different
 *   folders and serve different consumers. The lookup
 *   helpers (`resolvePalettePath`, `resolveBorder`) are
 *   *private* to the layout module — Phase 2.4.1's comment
 *   on `Box.resolveBorder` is explicit about this. Re-using
 *   them from `Surface` would force the layout module to
 *   export internals, which is the wrong direction.
 *
 *   The right answer is for `Surface` to author its own
 *   lookup helpers — the same pattern, duplicated locally
 *   rather than re-exported. The duplication is bounded
 *   (a few lines each) and the constraint (`Surface` does
 *   not import layout internals) is preserved.
 */
export function resolveSurface(props: SurfaceProps): ResolvedSurfaceVisual {
  const { theme } = props;

  // Pull the surface role. The default is `page` so a
  // `Surface` with no `surface` prop is a transparent page
  // container — the most common visual case.
  const surface: Roles['surface'][SurfaceKey] =
    theme.roles.surface[props.surface ?? 'page'];

  // Resolve the surface role's background path string
  // against the active palette. The path is two segments
  // (`bg.surface`); the resolver walks them.
  const background = resolvePalettePath(theme.colors, surface.background);

  // Resolve the surface role's elevation through the
  // elevation scale. The override prop wins when set.
  const surfaceElevation = surface.elevation;
  const elevation: ResolvedSurfaceVisual['elevation'] =
    props.elevation ?? surfaceElevation;

  // Resolve the surface role's padding and radius. These
  // are already-numeric values (the role layer pulls them
  // from the primitive scale), so the resolver can pass
  // them through directly. The override props win when set.
  const padding = resolvePaddingStep(
    props.padding,
    theme,
    surface.padding,
  );
  const radius = resolveRadiusStep(
    props.radius,
    theme,
    surface.radius,
  );

  // Resolve the border. If unset, the resolved shape has
  // `border: null` — a transparent, unbordersed container.
  const border = resolveBorder(props.border, theme);

  // Resolve the landmark role. Default to `'landmark'` —
  // the non-semantic role. The adapter translates the
  // resolved role into the platform's accessibility
  // attribute.
  const landmark: LandmarkRole = props.landmark ?? 'landmark';

  return Object.freeze({
    scheme: theme.scheme,
    background,
    elevation,
    radius,
    padding,
    border,
    landmark,
  });
}

/* ============================================================
 * Internal helpers
 * ========================================================== */

/**
 * Walk a two-segment dot path. The role layer's colour
 * slots are always two segments (`bg.surface`,
 * `border.borderFocus`), so a two-step walk is enough.
 *
 * The TypeScript signature is intentionally loose: the
 * resolver receives a `string` and the palette groups are
 * open-ended records. A consumer that misnames a path
 * receives `undefined` *at runtime* — a future TS-aware
 * path resolver would surface this as a compile error.
 * Today's resolver returns the value directly; the audit
 * step catches misnamed paths.
 *
 * The implementation is duplicated from
 * `Box.resolvePalettePath` (Phase 2.4.1) rather than
 * re-exported. The two helpers are *private* — they live
 * beside the resolver that uses them, and a future refactor
 * that promotes them to a shared module is a one-task
 * follow-up.
 */
function resolvePalettePath(
  palette: Theme['colors'],
  path: string,
): string {
  const [group, slot] = path.split('.') as [string, string];
  const groupValue = (palette as unknown as Record<string, Record<string, string>>)[group];
  if (groupValue === undefined) return '';
  const slotValue = groupValue[slot];
  return slotValue ?? '';
}

/**
 * Resolve a padding step. The prop precedence is:
 *   1. `props.padding` (if set) — the explicit override.
 *   2. `surfacePadding` (the surface role's `padding`
 *      field) — the role's natural padding.
 *
 * `'none'` is the explicit zero-padding sentinel and
 * resolves to `0` regardless of any override.
 *
 * Implementation is duplicated from `Box.resolvePaddingStep`
 * for the same reason as `resolvePalettePath` above.
 */
function resolvePaddingStep(
  prop: import('../layout/types').PaddingStep | undefined,
  theme: Theme,
  surfacePadding: number,
): number {
  if (prop === 'none') return 0;
  if (prop !== undefined) return theme.spacing[prop];
  return surfacePadding;
}

/**
 * Resolve a radius step. Same precedence as
 * `resolvePaddingStep`. `'none'` resolves to `0`; `'full'`
 * resolves to `9999` (the pill sentinel exposed by the
 * radius scale).
 *
 * Implementation is duplicated from `Box.resolveRadiusStep`
 * for the same reason as `resolvePalettePath` above.
 */
function resolveRadiusStep(
  prop: import('../layout/types').RadiusStepKey | undefined,
  theme: Theme,
  surfaceRadius: number,
): number {
  if (prop === 'none') return 0;
  if (prop !== undefined) return theme.radius[prop];
  return surfaceRadius;
}

/**
 * Resolve a border. Returns `null` when the border is unset
 * (the consumer did not pass a `border` prop), or when the
 * border is set to `'none'` (the explicit no-border sentinel).
 *
 * The border's colour is resolved through the palette's
 * `border.*` group. The five border levels map to the
 * palette's four colour slots:
 *
 *   `'none'`     → no border
 *   `'subtle'`   → `border.subtle`
 *   `'default'`  → `border.border`
 *   `'strong'`   → `border.borderStrong`
 *   `'focus'`    → `border.borderFocus`
 *
 * The mapping is hand-coded rather than derived because
 * the brief's border vocabulary has five levels and the
 * palette's `border.*` group has four colour slots — the
 * mapping is a role-layer concern, not a one-to-one derivation.
 * The widths are `1` for the common levels (`subtle`,
 * `default`, `strong`) and `2` for `focus` (the focus ring
 * is wider). The widths are hard-coded in this phase
 * because the `border.width.*` primitive scale does not
 * exist yet — when it lands, the resolver reads widths
 * from there.
 *
 * Implementation is duplicated from `Box.resolveBorder` for
 * the same reason as `resolvePalettePath` above. The two
 * resolvers agree on what a border is (same colour map,
 * same width map) so the duplication is mechanical — a
 * follow-up phase can extract the shared logic into a
 * layout-primitive helper if the duplication grows.
 */
function resolveBorder(
  level: BorderLevelKey | undefined,
  theme: Theme,
): ResolvedBorder | null {
  if (level === undefined || level === 'none') return null;

  const colorKey = borderLevelToColorKey(level);
  const width = borderLevelToWidth(level);

  const color = resolvePalettePath(
    theme.colors,
    `border.${colorKey}`,
  );

  return Object.freeze({
    level,
    color,
    width,
  });
}

/**
 * Map a `BorderLevel` to the palette colour key it resolves
 * against. The map is a constant — see `resolveBorder` for
 * the rationale.
 */
function borderLevelToColorKey(level: BorderLevelKey): string {
  switch (level) {
    case 'subtle':
      return 'subtle';
    case 'default':
      return 'border';
    case 'strong':
      return 'borderStrong';
    case 'focus':
      return 'borderFocus';
    case 'none':
      // unreachable — handled by the caller
      return '';
  }
}

/**
 * Map a `BorderLevel` to its width in pixels. The mapping
 * is a constant; see `resolveBorder` for the rationale.
 */
function borderLevelToWidth(level: BorderLevelKey): number {
  switch (level) {
    case 'subtle':
      return 1;
    case 'default':
      return 1;
    case 'strong':
      return 1;
    case 'focus':
      return 2;
    case 'none':
      return 0;
  }
}