/**
 * Layout primitives — resolved output shapes.
 *
 * The resolved shapes are the values a future platform
 * adapter (Phase 2.4+) translates into a real `View` / `div`
 * tree. A component file in this phase authors a *prop
 * contract* (input) and a *resolver function* (the
 * input→output transformation); the resolved shape is the
 * contract between the two halves.
 *
 * Why resolved shapes are declared separately from the
 * prop contracts:
 *   A resolver takes `BoxProps` and a `Theme` and returns a
 *   `ResolvedBox`. The returned shape is platform-neutral —
 *   it has no `style`, no `className`, no `View`/`div`
 *   intrinsic — only the design values an adapter will
 *   translate. A separate declaration makes the contract
 *   between component logic and adapter logic explicit.
 *
 * Why every field is a primitive `number` / `string` and
 * not a token reference:
 *   The resolver runs *before* the adapter. By the time the
 *   resolved shape reaches the adapter, every role has been
 *   looked up (`bg.surface` → `#F2F1EC`), every scale step
 *   resolved (`md` → `16`), every theme-aware choice made.
 *   The adapter receives values, not vocabulary. This is
 *   what makes the adapter a stable translation layer — it
 *   does not need to know what a "role" is, only what a
 *   colour string or a pixel value is.
 *
 * What's deliberately not in the resolved shapes:
 *   - No `style` object. A web adapter wraps the resolved
 *     fields into a CSS object; a native adapter wraps them
 *     into an RN style. The combining is the adapter's
 *     job, not the resolver's.
 *   - No event handlers. The layout primitives are
 *     non-interactive; a future Button / Input extends the
 *     contract with `onPress` / `onChange`.
 *   - No children. The resolved shape is the *parent's*
 *     contract; children are passed through unchanged.
 *   - No accessibility props. The brief asked for prop
 *     shapes that *don't make accessibility hard later* —
 *     the resolver passes through any accessibility prop
 *     the consumer set, but does not synthesise them.
 */

import type {
  ColorScheme,
  Palette,
} from '../../tokens/colors';

/* ============================================================
 * Resolved: surface-derived fields
 * ========================================================== */

/**
 * The fields a `Box` resolves from a `surface` role. The
 * adapter receives a fully-looked-up background colour
 * (the resolved hex, not the palette path), an elevation
 * level (which the adapter turns into a shadow), a corner
 * radius (a numeric pixel value), and a padding value (a
 * numeric pixel value).
 *
 * `padding` is the *unified* padding — Box takes a single
 * `padding` prop and resolves it to one number that the
 * adapter applies to all four sides. A future `paddingX` /
 * `paddingY` split is a one-line resolver change without
 * a contract break.
 *
 * `scheme` is the active colour scheme — `'light'` or
 * `'dark'`. The adapter does not need it directly, but
 * keeping it on the resolved shape lets a future audit
 * pass compare a component's resolved scheme against the
 * active theme without re-deriving it.
 */
export interface ResolvedSurface {
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
}

/* ============================================================
 * Resolved: flex-derived fields
 * ========================================================== */

/**
 * The fields a `Flex` or `Stack` resolves from its prop
 * contract. The adapter maps each field one-to-one to the
 * platform's flex primitive (CSS `display: flex` + four
 * named properties; RN `flexDirection` + `alignItems` +
 * `justifyContent` + `flexWrap`).
 *
 * `gap` is a single numeric pixel value — the same value
 * Flex applies between every pair of children. Asymmetric
 * row/column gap is a future addition (a `gapX` / `gapY`
 * split) that does not change this contract.
 */
export interface ResolvedFlex {
  /** The resolved flex direction. */
  readonly direction: 'row' | 'column' | 'row-reverse' | 'column-reverse';

  /** The resolved cross-axis alignment. */
  readonly align: 'start' | 'center' | 'end' | 'stretch' | 'baseline';

  /** The resolved main-axis justification. */
  readonly justify: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';

  /** The resolved wrap behaviour. */
  readonly wrap: 'nowrap' | 'wrap' | 'wrap-reverse';

  /** The resolved gap, in pixels. */
  readonly gap: number;
}

/* ============================================================
 * Resolved: border-derived fields
 * ========================================================== */

/**
 * A fully-resolved border line. The adapter receives the
 * resolved colour (a hex string), the resolved level (one
 * of the five border levels), and a numeric width in
 * pixels. The adapter joins the three into a platform
 * border declaration.
 *
 * `width` is in pixels — the same unit the adapter passes
 * through. The `border.width.*` primitive scale does not
 * exist yet in this phase; when it lands, the resolver
 * reads `width` from there and the resolved shape is
 * unchanged.
 */
export interface ResolvedBorder {
  /** The resolved border colour — a hex string. */
  readonly color: string;

  /** The resolved border level — `'none' | 'subtle' | 'default' | 'strong' | 'focus'`. */
  readonly level: 'none' | 'subtle' | 'default' | 'strong' | 'focus';

  /** The resolved border width — a numeric pixel value. */
  readonly width: number;
}

/* ============================================================
 * Resolved: divider
 * ========================================================== */

/**
 * A fully-resolved divider. The adapter receives the
 * orientation, the line colour, and a thickness in pixels.
 * Separating the divider's resolved shape from the Box
 * shape keeps the divider's contract small — a divider
 * has no padding, no elevation, no children.
 */
export interface ResolvedDivider {
  /** The resolved orientation — `'horizontal'` or `'vertical'`. */
  readonly orientation: 'horizontal' | 'vertical';

  /** The resolved line colour — a hex string. */
  readonly color: string;

  /** The resolved line thickness — a numeric pixel value. */
  readonly thickness: number;
}

/* ============================================================
 * Resolved: spacer
 * ========================================================== */

/**
 * A fully-resolved spacer. The adapter receives a single
 * axis (the direction the spacer grows) and a base size
 * in pixels. The adapter turns the spacer into a flex
 * item with `{ flex: 1, [axis]: baseSize }` (or its CSS
 * equivalent).
 *
 * `baseSize` is the *minimum* size — the spacer grows
 * beyond it when its siblings have leftover space. A
 * spacer with `baseSize: 16` first occupies 16 pixels,
 * then takes its share of the remaining container space.
 */
export interface ResolvedSpacer {
  /** The resolved growth axis. */
  readonly axis: 'horizontal' | 'vertical' | 'both';

  /** The resolved minimum size, in pixels. */
  readonly baseSize: number;
}

/* ============================================================
 * Resolved: palette reference (used by resolution internals)
 * ========================================================== */

/**
 * The minimal palette shape the resolver needs to look up
 * a `bg.*` / `fg.*` / `border.*` / `feedback.*` path string.
 *
 * Why this is declared here and not imported from
 * `../../tokens/colors`:
 *   The resolver only reads the palette's groups — it never
 *   needs the entire `Palette` interface (which includes
 *   `textOn`, `disabled`, etc., that no layout primitive
 *   reads). A minimal shape documents the contract more
 *   tightly and makes the resolver trivially testable with
 *   a smaller fixture.
 */
export interface ResolverPalette {
  readonly bg: Palette['bg'];
  readonly fg: Palette['fg'];
  readonly border: Palette['border'];
  readonly feedback: Palette['feedback'];
}
