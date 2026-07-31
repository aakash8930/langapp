/**
 * `Box` — the generic layout container.
 *
 * `Box` is the primitive every other layout primitive
 * builds on. It answers one design question: "what is the
 * surface of this part of the screen?" — a background, a
 * corner radius, internal padding, an elevation level, and
 * an optional border.
 *
 * Why `Box` is the foundation:
 *   Every other layout primitive in this phase is a
 *   *narrowing* of `Box`, not a parallel declaration.
 *   `Flex` is `Box` plus flex direction / alignment /
 *   justification; `Stack` is `Flex` restricted to a
 *   vertical / horizontal axis with a gap. A `Card` (a
 *   future phase) is `Box` with `surface: 'card'`. A
 *   `Button` is `Box` with `surface: 'card'`, a `flex`
 *   axis, and a press handler. Building `Box` first
 *   means every later primitive is one composition shallow,
 *   not a re-declaration deep.
 *
 * Surface resolution:
 *   `Box` accepts a `surface` prop typed as `SurfaceKey`
 *   (`'page' | 'card' | 'elevated' | 'overlay'`). The
 *   resolver reads `theme.roles.surface[surface]` and
 *   uses its `background`, `elevation`, `padding`, and
 *   `radius` to drive the resolved shape.
 *
 *   A consumer that wants a *different* surface from the
 *   role's preset can override any of the four fields:
 *   `padding`, `border`, `radius`, `elevation`. The
 *   override precedence is documented on the prop
 *   descriptions below.
 *
 * Why `Box` does not accept a raw `string` background:
 *   A `background: '#FF0000'` would bypass the token
 *   system and reintroduce the kind of drift Phase 2.1
 *   promised to prevent. The rule "components consume
 *   semantic roles, never primitive tokens" applies
 *   uniformly — the only way to get a hex into a `Box`
 *   is to add it to a role, which is the change-control
 *   gate.
 *
 * Immutability:
 *   The resolver returns a `ResolvedBox` whose fields are
 *   all `readonly`. The prop contract is also readonly
 *   beyond the child's content. A future runtime cannot
 *   mutate a resolved `Box` after the resolver returns.
 */

import type { ResolvedBox } from './resolved-box';
import type {
  SurfaceKey,
  PaddingStep,
  RadiusStepKey,
  BorderLevelKey,
  ElevationLevelKey,
} from './types';
import type { Theme } from '../../theme/types';
import type { Roles } from '../../theme/roles.types';

/* ============================================================
 * Prop contract
 * ========================================================== */

/**
 * The `Box` prop contract.
 *
 * Field precedence (highest wins):
 *   1. The explicit `padding` / `radius` / `elevation` /
 *      `border` props override the matching field on the
 *      surface role.
 *   2. If `surface` is unset, the four fields resolve to
 *      `'none'` / `0` / the page surface's no-op values
 *      — a `Box` with no surface is a transparent
 *      container with no shadow and no padding.
 *
 * Why the precedence is *role-then-override*, not
 * *override-then-role*:
 *   Designers think surface-first. A "card" is a card
 *   unless I say otherwise. The override pattern lets a
 *   consumer reach for a card's surface and tweak one
 *   field without re-declaring the rest.
 */
export interface BoxProps {
  /**
   * The surface role this `Box` adopts. Resolves through
   * `theme.roles.surface[surface]` to set the background,
   * elevation, padding, and radius in one read.
   *
   * Default: `'page'` — the resting page surface, so a
   * `Box` with no surface prop is a transparent page
   * background. A consumer that wants a blank container
   * passes `surface` explicitly to declare intent.
   */
  readonly surface?: SurfaceKey;

  /**
   * Override the surface role's padding. Accepts a padding
   * step (`'none' | '3xs' | '2xs' | 'xs' | 'sm' | 'md' | 'lg' |
   * 'xl' | '2xl' | '3xl' | '4xl' | '5xl'`) that resolves
   * against `theme.spacing`.
   *
   * `'none'` is the explicit zero-padding sentinel —
   * distinct from `'3xs'`, which is `2px` and has its own
   * role as the inline-icon gap.
   */
  readonly padding?: PaddingStep;

  /**
   * Override the surface role's corner radius. Accepts a
   * radius step (`'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' |
   * 'full'`) that resolves against `theme.radius`.
   *
   * `'none'` is the hard-edge sentinel; `'full'` is the
   * pill / circle sentinel.
   */
  readonly radius?: RadiusStepKey;

  /**
   * The elevation level. Accepts any of the six elevation
   * levels (`'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl'`).
   * If both `surface` and `elevation` are set, `elevation`
   * overrides the surface role's elevation field.
   *
   * Default: `undefined` — the resolver reads the
   * surface role's elevation. Setting `elevation: 'none'`
   * explicitly is the way to opt a card out of its shadow
   * without changing the surface.
   */
  readonly elevation?: ElevationLevelKey;

  /**
   * The border level. Accepts any of the five border
   * levels (`'none' | 'subtle' | 'default' | 'strong' | 'focus'`).
   * If `surface` is set, the border's colour is added on
   * top of the surface background — the resolver does not
   * toggle the surface off.
   *
   * Default: `undefined` — the resolver produces no
   * border. Setting `border: 'subtle'` is the way to add
   * a hairline edge to a card without suppressing the
   * shadow.
   */
  readonly border?: BorderLevelKey;

  /**
   * The theme reference. The resolver needs the theme to
   * read the role layer and the primitive scales. The
   * prop is typed but the resolver does not require it
   * at *call time* — the runtime Theme provider (Phase
   * 2.4+) is what passes the active theme in.
   *
   * A theme-typed prop on the contract makes the resolver
   * testable without a global Theme; a future test calls
   * `resolveBox({ surface: 'card' }, lightTheme)` directly.
   */
  readonly theme: Theme;
}

/* ============================================================
 * Resolver
 * ========================================================== */

/**
 * Resolve a `Box` to its rendered shape.
 *
 * The resolver is a pure function — it takes the props
 * and the active theme, and returns a `ResolvedBox` that
 * a future platform adapter translates into a real
 * `View` / `div` tree. No side effects, no React, no
 * platform code.
 *
 * Resolution order:
 *   1. Resolve `surface` against `theme.roles.surface`. If
 *      unset, fall back to `theme.roles.surface.page` (the
 *      resting default).
 *   2. Resolve the surface's `background` path string
 *      against `theme.colors`. The path string
 *      (`'bg.surface'`) becomes a keyed lookup; the
 *      resolved value is a hex string.
 *   3. Apply the override precedence: a `padding` / `radius`
 *      / `elevation` prop replaces the surface role's
 *      matching field; a `border` prop adds a border on
 *      top.
 *   4. Resolve the props' step keys through the matching
 *      primitive scale (`theme.spacing[padding]`,
 *      `theme.radius[radius]`, etc.).
 *   5. Resolve the border's colour through the palette's
 *      `border.*` group.
 *
 * Path-string resolution:
 *   Role fields like `bg.surface` are dot-delimited paths
 *   into the palette. The resolver walks the path with a
 *   two-step lookup (`palette.bg.surface`). The lookup is
 *   type-safe at the call site — the role's `background`
 *   field is typed as a `bg.*` path, not a `string`.
 */
export function resolveBox(props: BoxProps): ResolvedBox {
  const { theme } = props;

  // Pull the surface role. The default is `page` so a
  // `Box` with no `surface` prop is a transparent page
  // container — the most common layout case.
  const surface: Roles['surface'][SurfaceKey] =
    theme.roles.surface[props.surface ?? 'page'];

  // Resolve the surface role's background path string
  // against the active palette. The path is two segments
  // (`bg.surface`); the resolver walks them.
  const background = resolvePalettePath(theme.colors, surface.background);

  // Resolve the surface role's elevation through the
  // elevation scale. The role holds a level key; the
  // resolved shape holds the level key (the adapter
  // turns it into a shadow).
  const surfaceElevation = surface.elevation;

  // Resolve the surface role's padding and radius. These
  // are already-numeric values (the role layer pulls
  // them from the primitive scale), so the resolver can
  // pass them through directly. The override props win
  // when set.
  const padding = resolvePaddingStep(props.padding, theme, surface.padding);
  const radius = resolveRadiusStep(props.radius, theme, surface.radius);

  // Resolve the elevation override. If the consumer set
  // `elevation`, that wins; otherwise the surface role's
  // elevation wins.
  const elevation: ResolvedBox['elevation'] = props.elevation ?? surfaceElevation;

  // Resolve the border. If unset, the resolved shape has
  // `border: null` — a transparent, unbordersed container.
  // A future `border: 'none'` is treated as `undefined`
  // for symmetry, since `'none'` is the explicit "no
  // border" sentinel.
  const border = resolveBorder(props.border, theme);

  return Object.freeze({
    scheme: theme.scheme,
    background,
    elevation,
    radius,
    padding,
    border,
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
 * resolver receives a `string` and the palette groups
 * are open-ended records. A consumer that misnames a
 * path receives `undefined` *at runtime* — a future
 * TypeScript-aware path resolver would surface this as a
 * compile error. Today's resolver returns the value
 * directly; the audit step (Phase 2.4+) is what catches
 * misnamed paths.
 */
function resolvePalettePath(palette: Theme['colors'], path: string): string {
  const [group, slot] = path.split('.') as [string, string];
  // The palette groups are open-ended records; the
  // resolver looks up by string key. A consumer that
  // authored a path the palette does not export gets
  // `undefined` here, which is what the audit catches.
  //
  // The non-null assertion is documented inline: the
  // resolver is unit-tested by the audit, and a future
  // strict variant returns the path string verbatim on
  // miss.
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
 */
function resolvePaddingStep(
  prop: PaddingStep | undefined,
  theme: Theme,
  surfacePadding: number,
): number {
  if (prop === 'none') return 0;
  if (prop !== undefined) return theme.spacing[prop];
  return surfacePadding;
}

/**
 * Resolve a radius step. Same precedence as
 * `resolvePaddingStep`. `'none'` resolves to `0`;
 * `'full'` resolves to `9999` (the pill sentinel exposed
 * by the radius scale).
 */
function resolveRadiusStep(
  prop: RadiusStepKey | undefined,
  theme: Theme,
  surfaceRadius: number,
): number {
  if (prop === 'none') return 0;
  if (prop !== undefined) return theme.radius[prop];
  return surfaceRadius;
}

/**
 * Resolve a border. Returns `null` when the border is
 * unset (the consumer did not pass a `border` prop), or
 * when the border is set to `'none'` (the explicit no-
 * border sentinel — equivalent to unset for a divider
 * shape).
 *
 * The border's colour is resolved through the palette's
 * `border.*` group. The map from `BorderLevel` to
 * palette key is:
 *
 *   `'none'`     → no border
 *   `'subtle'`   → `border.subtle`
 *   `'default'`  → `border.border`
 *   `'strong'`   → `border.borderStrong`
 *   `'focus'`    → `border.borderFocus`
 *
 * The mapping is hand-coded rather than derived
 * programmatically because the brief's border
 * vocabulary has five levels and the palette's
 * `border.*` group has three colour slots — the
 * mapping is a role-layer concern, not a one-to-one
 * derivation.
 *
 * The width is `1` for the common levels (`subtle`,
 * `default`, `strong`) and `2` for `focus` (the focus
 * ring is wider). `'none'` has no width. The widths
 * are hard-coded in this phase because the
 * `border.width.*` primitive scale (Phase 2.2's
 * roadmap) does not exist yet — when it lands, the
 * resolver reads widths from there.
 */
function resolveBorder(
  level: BorderLevelKey | undefined,
  theme: Theme,
): ResolvedBox['border'] {
  if (level === undefined || level === 'none') return null;

  const colorKey = borderLevelToColorKey(level);
  const width = borderLevelToWidth(level);

  // The palette's `border.*` group is keyed by the
  // three colour names — `border.subtle`, `border.border`,
  // `border.borderStrong`, `border.borderFocus`. The
  // resolver joins the prefix and the key name.
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
 * Map a `BorderLevel` to the palette colour key it
 * resolves against. The map is a constant — see
 * `resolveBorder` for the rationale.
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
 * Map a `BorderLevel` to its width in pixels. The
 * mapping is a constant; see `resolveBorder` for the
 * rationale.
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
