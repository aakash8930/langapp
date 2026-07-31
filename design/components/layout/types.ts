/**
 * Layout primitives — shared type contracts.
 *
 * Every layout primitive in this phase consumes semantic
 * tokens through the theme roles layer (or, where a
 * dedicated role does not exist, through the named steps
 * of an existing primitive scale — the steps *are* the
 * semantic vocabulary: `space.md`, `radius.lg`, `elevation.
 * sm`, etc.).
 *
 * The five primitives (`Box`, `Flex`, `Stack`, `Spacer`,
 * `Divider`) share four prop contracts declared here:
 *
 *   1. `SurfaceKey`     — a key into `theme.roles.surface`
 *                         (page | card | elevated | overlay)
 *   2. `PaddingStep`    — a key into the spacing scale
 *                         (`'none' | '3xs' | ... | '5xl'`)
 *   3. `RadiusStep`     — a key into the radius scale
 *   4. `BorderLevelKey` — a key into `theme.border`
 *                         (none | subtle | default | strong | focus)
 *   5. `ElevationLevelKey` — a key into `theme.elevation`
 *
 * These are *unions*, not enums — they are derived from
 * the existing primitive scales via `keyof`, so adding a
 * new spacing step or border level propagates automatically
 * through every primitive that reads it. No primitive re-
 * declares the key set in parallel.
 *
 * Why a separate `types.ts` and not per-component type
 * files:
 *   Five primitives share these unions. Five separate
 *   declarations of the same `SurfaceKey = keyof Roles[
 *   'surface']` would drift the moment one of them gets
 *   refactored. One declaration is the property that
 *   makes the primitive vocabulary cohere.
 *
 * Why each union is exported separately rather than
 * composed into a `LayoutKeys` mega-type:
 *   A consumer authoring a prop type (`prop: SurfaceKey`)
 *   needs only the surface key, not the radius key too.
 *   Named imports (`import type { SurfaceKey }`) make
 *   the dependency explicit at the call site.
 */

import type { Roles } from '../../theme/roles.types';
import type { SpacingStep } from '../../tokens/spacing';
import type { RadiusStep } from '../../tokens/radius';
import type { BorderLevel } from '../../tokens/borders';
import type { ElevationLevel } from '../../tokens/elevation';

/* ============================================================
 * Surface / spacing / radius / border / elevation keys
 * ========================================================== */

/**
 * A key into `theme.roles.surface` — the four named surface
 * roles the design ships. `Box` accepts this prop and resolves
 * the matching surface role's background, elevation, padding
 * and radius.
 */
export type SurfaceKey = keyof Roles['surface'];

/**
 * A key into the spacing scale. Spacing is the *semantic*
 * spacing vocabulary — the scale's named steps
 * (`3xs | 2xs | xs | sm | md | lg | xl | 2xl | 3xl | 4xl | 5xl`)
 * are themselves the role names. A primitive that accepts a
 * `padding: SpacingStep` reads `theme.spacing[padding]` to
 * get the resolved pixel value.
 *
 * `'none'` is added as a non-spacing sentinel — `padding:
 * 'none'` resolves to `0`, distinct from any of the eleven
 * steps. Without it, the only way to opt out of inherited
 * padding is `padding: '3xs'`, which is incorrect intent.
 */
export type PaddingStep = 'none' | SpacingStep;

/**
 * A key into the radius scale. Same semantic-vocabulary
 * reasoning as `PaddingStep`. `'none'` is the zero-radius
 * sentinel; `'full'` is the pill/circle sentinel.
 */
export type RadiusStepKey = 'none' | RadiusStep;

/**
 * A key into `theme.border` — the five border levels. A
 * primitive that accepts a `border: BorderLevelKey` resolves
 * the level's metadata record; the platform adapter (Phase
 * 2.4+) translates that record to a real border.
 */
export type BorderLevelKey = BorderLevel;

/**
 * A key into `theme.elevation` — the six elevation levels
 * (`none | xs | sm | md | lg | xl`). Same reasoning as
 * `BorderLevelKey`.
 */
export type ElevationLevelKey = ElevationLevel;

/* ============================================================
 * Cross-component axis / orientation keys
 * ========================================================== */

/**
 * A flex direction. The four values match the CSS `flex-
 * direction` and the RN equivalent (`row | column | row-
 * reverse | column-reverse`).
 */
export type FlexDirection = 'row' | 'column' | 'row-reverse' | 'column-reverse';

/**
 * A cross-axis alignment. Maps to CSS `align-items` and
 * RN `alignItems`. `'stretch'` is the default and the most
 * common choice; the others cover the rare alignment needs.
 */
export type FlexAlign = 'start' | 'center' | 'end' | 'stretch' | 'baseline';

/**
 * A main-axis justification. Maps to CSS `justify-content`
 * and RN `justifyContent`.
 */
export type FlexJustify = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';

/**
 * A wrap behaviour. `'nowrap'` is the default and most
 * common; the others cover wrapping containers.
 */
export type FlexWrap = 'nowrap' | 'wrap' | 'wrap-reverse';

/**
 * A divider's orientation. `'horizontal'` draws a top-to-
 * bottom line (a row separator); `'vertical'` draws a left-
 * to-right line (a column separator).
 */
export type DividerOrientation = 'horizontal' | 'vertical';

/**
 * A spacer's growth axis. `'horizontal'` lets the spacer
 * grow on the X axis; `'vertical'` on the Y axis; `'both'`
 * lets it grow in both directions (the rare flex-spacer
 * case).
 */
export type SpacerAxis = 'horizontal' | 'vertical' | 'both';
