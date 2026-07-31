/**
 * Surface primitives — resolved output shapes.
 *
 * The resolved shapes are the values a future platform
 * adapter (Phase 2.4+) translates into a real CSS `div`
 * with a `box-shadow`, an RN `View` with a shadow prop
 * tuple, a `<card>` element, a `<region>` element, etc.
 * A component file in this phase authors a *prop contract*
 * (input) and a *resolver function* (the input→output
 * transformation); the resolved shape is the contract
 * between the two halves.
 *
 * Why resolved shapes are declared separately from the
 * prop contracts:
 *   A resolver takes `SurfaceProps` (or `CardProps`,
 *   `ContainerProps`) and a `Theme`, and returns a
 *   resolved shape. The returned shape is platform-
 *   neutral — it has no `style`, no `className`, no
 *   `View` intrinsic — only the design values an adapter
 *   will translate. A separate declaration makes the
 *   contract between component logic and adapter logic
 *   explicit, and lets the resolver be unit-tested with
 *   a smaller fixture than the prop contract would
 *   suggest.
 *
 * Why every field is a primitive `number` / `string` and
 * not a token reference:
 *   The resolver runs *before* the adapter. By the time the
 *   resolved shape reaches the adapter, every role has been
 *   looked up, every scale step resolved, every border
 *   colour walked. The adapter receives values, not
 *   vocabulary. This is what makes the adapter a stable
 *   translation layer — it does not need to know what a
 *   "role" is, only what a colour string or a pixel value
 *   is.
 *
 * Why `ResolvedSurfaceVisual` and not `ResolvedSurface`:
 *   Phase 2.4.1's layout module already exports a
 *   `ResolvedSurface` — a flat record with `scheme`,
 *   `background`, `elevation`, `radius`, `padding`. The
 *   surface module's resolved shape adds `border` and
 *   `landmark` on top. The two are different values — the
 *   layout one is what `Box` resolves to (no border, no
 *   landmark), the surface one is what `Surface` resolves
 *   to (border and landmark metadata). Renaming the
 *   surface one to `ResolvedSurfaceVisual` keeps both
 *   names visible at the call site (`ResolvedSurface` is
 *   the layout surface; `ResolvedSurfaceVisual` is the
 *   surface-primitive surface) and avoids a silent
 *   collision in the components barrel.
 *
 *   A future consolidation could move the layout module's
 *   `ResolvedSurface` into the surface module and rename
 *   it, but that is a Phase 2.4.1 retrofit — out of scope
 *   for this phase.
 *
 * What's deliberately not in the resolved shapes:
 *   - No `style` object. A web adapter wraps the resolved
 *     fields into a CSS object; a native adapter wraps them
 *     into an RN style. The combining is the adapter's
 *     job, not the resolver's.
 *   - No `children`. The resolved shape is the *parent's*
 *     contract; children are passed through unchanged.
 *   - No event handlers. Surface primitives are non-
 *     interactive in this phase.
 *   - No runtime layout. `ContainerWidth` and
 *     `ContainerPadding` are metadata-only profile keys
 *     the adapter resolves against the platform's viewport
 *     model — the resolver does not compute viewport
 *     widths, and the resolved shape does not carry
 *     computed pixel widths.
 */

import type { ColorScheme } from '../../tokens/colors';
import type { ResolvedBorder } from '../layout/resolved';
import type { LandmarkRole } from './types';

/* ============================================================
 * Resolved: surface-derived fields
 * ========================================================== */

/**
 * The fully-resolved surface. Composes a `ResolvedBorder`
 * (the border's level, colour, and width) with the
 * surface-specific fields (background, elevation, radius,
 * padding) and the accessibility-landmark metadata.
 *
 * The composition extends `ResolvedBorder` (which itself
 * is the layout module's border shape) — the two records
 * agree on what a "border" is. The surface-specific
 * fields are flat (background, elevation, radius,
 * padding, landmark) — the adapter spreads them into a
 * single style object without further nesting.
 *
 * `landmark` is the accessibility metadata the adapter
 * forwards to the platform's accessibility tree. The
 * adapter translates the key into the platform's
 * accessibility attribute (HTML element role, RN
 * `accessibilityRole`, etc.). The field is required
 * (every surface has a landmark role; `'landmark'` is
 * the default non-semantic one).
 *
 * `scheme` is the active colour scheme at resolve time,
 * kept on the resolved shape for the same reason as in
 * Phase 2.4.1: a future audit pass can compare a
 * component's resolved scheme against the active theme
 * without re-deriving it.
 */
export interface ResolvedSurfaceVisual {
  /** The active scheme at resolve time — `'light'` or `'dark'`. */
  readonly scheme: ColorScheme;

  /**
   * The resolved background colour — a hex string (`'#F2F1EC'`)
   * looked up from the active palette through the surface role's
   * `background` path. The adapter does not interpret this
   * string; it passes it to the platform's colour input.
   */
  readonly background: string;

  /**
   * The resolved elevation level (`'none' | 'xs' | 'sm' | 'md' |
   * 'lg' | 'xl'`). The adapter turns this into a CSS
   * `box-shadow` or an RN shadow prop tuple.
   */
  readonly elevation:
    | 'none'
    | 'xs'
    | 'sm'
    | 'md'
    | 'lg'
    | 'xl';

  /**
   * The resolved corner radius — a numeric pixel value (e.g.
   * `8`). The adapter applies this to the platform's
   * `borderRadius` / `border-radius` prop.
   */
  readonly radius: number;

  /** The resolved internal padding — a numeric pixel value. */
  readonly padding: number;

  /**
   * The resolved border. `null` when the consumer did not
   * pass a `border` prop (or passed `border: 'none'`).
   * Same shape as `ResolvedBox.border` — the two resolution
   * shapes agree on what a border is.
   */
  readonly border: ResolvedBorder | null;

  /**
   * The resolved landmark role — the accessibility metadata
   * the adapter forwards to the platform's accessibility
   * tree. Required (every surface has a landmark role).
   */
  readonly landmark: LandmarkRole;
}

/* ============================================================
 * Resolved: card-derived fields
 * ========================================================== */

/**
 * The fully-resolved card. Composes `ResolvedSurfaceVisual`
 * with the resolved card variant — the visual treatment the
 * consumer chose (`'default' | 'outlined' | 'elevated' |
 * 'filled'`).
 *
 * The variant is *not* a visual styling override — the
 * visual styling is the resolved surface beneath it. The
 * variant is *metadata* the adapter can use to pick the
 * right platform-specific element (an outlined card might
 * warrant a different HTML element than a filled card on
 * a screen-reader-friendly voiceover target).
 *
 * `id` is the card's optional identifier — passed through
 * when the consumer sets one, omitted when unset. The
 * adapter forwards it as the DOM id on web, or as the
 * `testID` on RN. A consumer that needs a stable handle
 * (an integration test, a screen-reader stop) sets `id`
 * explicitly.
 */
export interface ResolvedCard extends ResolvedSurfaceVisual {
  /**
   * The resolved card variant — the visual treatment the
   * consumer chose, after resolution.
   */
  readonly variant: 'default' | 'outlined' | 'elevated' | 'filled';

  /**
   * The card's identifier, if any. The adapter forwards
   * this as the DOM id on web and the `testID` on RN.
   */
  readonly id?: string;
}

/* ============================================================
 * Resolved: container-derived fields
 * ========================================================== */

/**
 * The fully-resolved container. Composes `ResolvedSurfaceVisual`
 * with the container's width and padding profile metadata.
 *
 * `width` and `padding` are *profile keys* — the same
 * `ContainerWidth` and `ContainerPadding` union the
 * consumer passed in. The resolver does not compute
 * viewport widths or pixel values; the adapter turns the
 * profile into the platform's responsive constraint.
 *
 * Why the resolved shape carries the *profile key* and not
 * the computed pixel value:
 *   A container is responsive — the same `Container` on a
 *   phone and a tablet (or a web page on different screen
 *   widths) needs different concrete pixel values. The
 *   adapter, which has the viewport model, computes the
 *   pixel value at render time. The resolver hands the
 *   profile through; the adapter interprets it.
 */
export interface ResolvedContainer extends ResolvedSurfaceVisual {
  /**
   * The resolved content-width profile — a profile key
   * the adapter maps to the platform's responsive width.
   */
  readonly width: 'narrow' | 'medium' | 'wide' | 'full';

  /**
   * The resolved padding profile — a profile key the
   * adapter maps to the platform's responsive padding.
   */
  readonly paddingProfile: 'none' | 'tight' | 'comfortable' | 'spacious';
}