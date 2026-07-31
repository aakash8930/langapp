/**
 * Theme type definitions.
 *
 * This file declares the *shape* of the Theme — what fields exist,
 * what types they hold, what a consumer can autocomplete to. It holds
 * no values. Every type reference resolves to a type already exported
 * from `../tokens/*`, so the Theme interface is a composition of
 * existing contracts rather than a parallel declaration.
 *
 * Why no `interface extends` and no value duplication:
 *   The seven primitive subsystems already define their own public
 *   types — `Palette`, `Spacing`, `Radius`, `BorderLevelMeta`/etc,
 *   `ElevationLevelMeta`/etc, `Duration`/`Easing`, and the five
 *   typography groups. Re-declaring those types here would create
 *   a parallel surface that drifts the moment a primitive changes.
 *   Instead, `Theme` is an *intersection of references*: every
 *   field points at the type the subsystem already exports.
 *
 * Why a single `Theme` interface rather than per-category generics:
 *   Consumers want to read `theme.spacing.md` and get a number, and
 *   to read `theme.colors.bg.app` and get a string. A single
 *   interface with named fields is what makes that autocomplete
 *   work. A generic (`Theme<C, S, R, …>`) would force every call
 *   site to declare which category it cares about, and a consumer
 *   that reads two categories would need two type parameters —
 *   which is more ceremony than the design needs.
 *
 * Why `Theme['colors'] = Palette` instead of `Theme['colors']: Palette`:
 *   Both forms work in TS, but the index-signature form matches
 *   the prior convention (`ColorTokenName = typeof …`) and lets a
 *   future phase add a derived field — e.g. `Theme['resolved']` —
 *   without changing this file's structure. It also signals
 *   "this is a reference, not a redeclaration".
 */

import type { Palette, ColorScheme } from '../tokens/colors';
import type { SpacingScale } from '../tokens/spacing';
import type { RadiusScale } from '../tokens/radius';
import type { BorderLevelMeta } from '../tokens/borders';
import type { ElevationLevelMeta } from '../tokens/elevation';
import type { Duration, Easing } from '../tokens/motion';
import type {
  FontFamily,
  FontSize,
  LineHeight,
  FontWeight,
  LetterSpacing,
} from '../tokens/typography';
import type { Roles } from './roles.types';

/**
 * The complete public API of a Theme.
 *
 * Every field is a reference to an existing primitive type — the
 * Theme does not introduce new types, only composes existing ones.
 * A consumer reads `theme.spacing.md` and gets `number`, exactly
 * the type that `Spacing['md']` already yields.
 */
export interface Theme {
  /** The colour scheme this theme represents — `'light'` or `'dark'`. */
  readonly scheme: ColorScheme;

  /**
   * The active colour palette. The shape is identical between
   * `lightTheme` and `darkTheme` — only the values change. The
   * `ColorScheme` field above is what a consumer reads to know
   * which one is in use; the values themselves resolve through
   * `theme.colors.bg.surface`, `theme.colors.fg.textPrimary`, etc.
   */
  readonly colors: Palette;

  /** Spacing scale, identical across themes. */
  readonly spacing: SpacingScale;

  /** Corner-radius scale, identical across themes. */
  readonly radius: RadiusScale;

  /**
   * Border level metadata. Each level is a frozen record — not a
   * CSS string or an RN style — because borders are a *role*
   * (subtle / default / strong / focus), not a value. A platform
   * adapter (Phase 2.3+) translates the level to the platform's
   * actual border shape; the role names are constant.
   */
  readonly border: Readonly<Record<
    'none' | 'subtle' | 'default' | 'strong' | 'focus',
    BorderLevelMeta
  >>;

  /**
   * Elevation level metadata. Same shape as `border`: a level
   * (none / xs / sm / md / lg / xl), each a frozen metadata
   * record describing the role, not the shadow value. The
   * platform adapter turns the level into a CSS `box-shadow`
   * or an RN shadow prop tuple.
   */
  readonly elevation: Readonly<Record<
    'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl',
    ElevationLevelMeta
  >>;

  /**
   * Motion primitives — durations in milliseconds and cubic-bezier
   * control-point tuples. Two separate fields because they answer
   * different design questions and a future composed-token phase
   * will read them independently.
   */
  readonly motion: {
    readonly duration: Duration;
    readonly easing: Easing;
  };

  /**
   * Typography primitives — five independent groups. The five
   * fields are exposed individually because a component's text
   * style typically composes one entry from each (a fontSize +
   * a lineHeight + a fontWeight + a letterSpacing + a fontFamily
   * reference), and exposing them flat makes the consumer's
   * code read as `theme.typography.fontSize.md` rather than
   * `theme.typography.scale.fontSize.md`.
   */
  readonly typography: {
    readonly fontFamily: FontFamily;
    readonly fontSize: FontSize;
    readonly lineHeight: LineHeight;
    readonly fontWeight: FontWeight;
    readonly letterSpacing: LetterSpacing;
  };

  /**
   * Semantic roles — the final abstraction between primitives
   * and components. Components consume roles through their
   * resolver functions (Phase 2.4+) and never reach into
   * primitives directly. The roles are theme-independent;
   * colour paths inside each role resolve against this
   * theme's `colors` at consumer call time.
   *
   * Added in Phase 2.4.1 — the first phase where components
   * consume the Theme. The field exists so a `Theme` is a
   * single object containing every value a component needs.
   */
  readonly roles: Roles;
}
