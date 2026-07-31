/**
 * Surface primitives — shared type contracts.
 *
 * Three primitives in this phase: `Surface`, `Card`, `Container`.
 * Each consumes the surface role layer (`theme.roles.surface`),
 * the border role layer (`theme.roles.border`), and the elevation
 * role layer (`theme.roles.elevation`) — never the underlying
 * primitives. The surface primitives are the *visual* foundation
 * of the design system: where the layout primitives (Box, Flex,
 * Stack, Spacer, Divider) answer "how do children arrange?", the
 * surface primitives answer "what does the container look like?"
 *
 * Why surface primitives are separate from layout primitives:
 *   Layout is about arranging children (axis, alignment, gap,
 *   padding for spacing). Surface is about the visual treatment
 *   of the container itself (background, border, elevation,
 *   corner radius). A `Card` is a content container with its
 *   own visual identity; a `Box` is a layout primitive that
 *   happens to surface. The two are orthogonal — a `Card` does
 *   not need a `Box` to render, and a `Box` does not need a
 *   `Card` to surface. Keeping them separate lets a future
 *   `Button` (a control) compose `Surface` for its visual
 *   treatment without inheriting layout, and a `Flex` (a layout
 *   primitive) gain a surface without inheriting Card semantics.
 *
 * The shared contracts declared here:
 *
 *   1. `CardVariant`     — a card's visual variant role
 *                          (default | outlined | elevated | filled)
 *   2. `ContainerWidth`  — a content-width profile
 *                          (narrow | medium | wide | full)
 *   3. `ContainerPadding` — a container padding profile
 *                           (none | tight | comfortable | spacious)
 *   4. `LandmarkRole`    — an accessibility landmark metadata
 *                          (region | section | article | presentation | landmark)
 *
 * Each is a *union*, not an enum — derived from the role layer
 * or hand-coded as a fixed vocabulary, so adding a variant or
 * profile is a one-line addition that propagates through every
 * component that reads the union.
 *
 * Why these contracts live in their own file rather than per-
 * component:
 *   Three surface primitives share `CardVariant` and
 *   `LandmarkRole`. Per-component declarations would drift the
 *   moment one of them is refactored. One declaration is the
 *   property that keeps the surface vocabulary coherent.
 */

import type { Roles } from '../../theme/roles.types';
import type { BorderLevel } from '../../tokens/borders';
import type { ElevationLevel } from '../../tokens/elevation';

/* ============================================================
 * Surface / border / elevation keys
 * ========================================================== */

/**
 * A key into `theme.roles.surface`. The four named surface
 * roles the design ships — `page`, `card`, `elevated`,
 * `overlay`. `Surface` accepts this prop and resolves the
 * matching surface role's background, elevation, padding and
 * radius.
 *
 * Naming note: `SurfaceKey` is the same name Phase 2.4.1's
 * layout module uses. The two surfaces are different values
 * (the layout one is a *Box* surface prop; the surface one
 * is a *Surface* surface prop) but the union is the same —
 * both resolve against the same `theme.roles.surface` table.
 * The alias is intentional: one role vocabulary, two
 * primitive layers that consume it.
 */
export type SurfaceKey = keyof Roles['surface'];

/**
 * A key into the *primitive* border scale — the five
 * border levels (`none | subtle | default | strong | focus`).
 * `Surface` accepts this prop and resolves the level's
 * colour through the palette's `border.*` group, and the
 * width through the border-level metadata.
 *
 * Note on the relationship between `BorderLevelKey` and
 * `theme.roles.border`: the role layer exposes only two
 * named border roles (`default`, `focus`) — the resting
 * outline and the focus ring. The full five-level scale
 * lives in `tokens/borders.ts`. `Surface` accepts the
 * full five-level union (the *primitive* union), not the
 * role layer's two-key subset, because the role layer's
 * role values are *path strings* (e.g. `'border.borderFocus'`)
 * that the resolver already resolves at composition time.
 * The prop is typed against the full union so a consumer
 * that wants `'subtle'` or `'strong'` (a hairline divider,
 * a deliberate boundary) has a typed escape hatch.
 *
 * The alias is the same shape Phase 2.4.1's layout module
 * uses, for the same reason (one vocabulary, multiple
 * primitive consumers).
 */
export type BorderLevelKey = BorderLevel;

/**
 * A key into the elevation primitive scale — the six
 * elevation levels (`none | xs | sm | md | lg | xl`).
 * `Surface` accepts this prop and resolves the level's
 * metadata record; the platform adapter turns the level
 * into a CSS `box-shadow` or an RN shadow prop tuple.
 *
 * The brief says "consume only theme.roles.elevation" —
 * the role layer's elevation shape is a metadata record
 * (`BorderLevelMeta`-equivalent for elevation), and the
 * level keys come from the elevation primitive's
 * `ElevationLevel` union. The resolver reads
 * `theme.elevation[level]` for the level metadata; the
 * *key* is what the consumer passes.
 */
export type ElevationLevelKey = ElevationLevel;

/* ============================================================
 * Card variant
 * ========================================================== */

/**
 * A card's visual variant — the semantic choice a consumer
 * makes when authoring a card. The four values are not
 * parallel declarations of the same idea; they are four
 * distinct visual treatments that resolve to different
 * combinations of surface, border, and elevation.
 *
 *   - `'default'`  — the resting card. `surface.card` with
 *                    `border.subtle`. The most common card.
 *   - `'outlined'` — `surface.card` with `border.default`.
 *                    A card that reads as a defined edge with
 *                    no shadow. For lists of cards that must
 *                    not compete with each other.
 *   - `'elevated'` — `surface.card` with `elevation.md` and
 *                    no border. A card that lifts off the page.
 *                    For featured content where shadow is the
 *                    emphasis.
 *   - `'filled'`   — `surface.elevated` with no border. A
 *                    card that fills with a different surface
 *                    colour. For grouped content within a
 *                    page-coloured card.
 *
 * Why `CardVariant` is a hand-coded union and not derived
 * from `theme.roles`:
 *   The variant vocabulary is a *consumer* choice — what a
 *   designer or developer authoring a card reaches for. The
 *   mapping from variant to (surface, border, elevation) is
 *   the role layer's concern, and lives in this phase's
 *   resolver. Adding a fifth variant (`'ghost'`) is a one-
 *   line addition to the union and the resolver's switch,
 *   not a role-layer edit.
 */
export type CardVariant =
  | 'default'
  | 'outlined'
  | 'elevated'
  | 'filled';

/* ============================================================
 * Container width / padding profiles
 * ========================================================== */

/**
 * A content-width profile — a *named* container width,
 * resolved at the adapter layer against the platform's
 * viewport model. The four values are design language, not
 * pixel values; the resolver hands the key through to the
 * adapter, which maps it to a concrete width.
 *
 *   - `'narrow'`  — reading-width content (paragraphs, forms).
 *                   The narrowest width that respects line-length
 *                   readability (~60–70 characters).
 *   - `'medium'`  — default content width (most page bodies).
 *   - `'wide'`    — page surfaces that need more horizontal
 *                   space (dashboards, lists with multiple
 *                   columns).
 *   - `'full'`    — bleed to the viewport edge. The container
 *                   is the screen.
 *
 * Why `ContainerWidth` is a hand-coded union and not derived
 * from `theme.spacing`:
 *   A container width is a *layout intent*, not a spacing
 *   value. The resolver hands the key to the adapter; the
 *   adapter maps it to `max-width: 720px` (or `1024px`, or
 *   `100%`) on web, or to a `maxWidth` style prop on RN.
 *   The values are design tokens at the *role* layer but
 *   not at the spacing primitive level — they are a
 *   container-width scale, a separate concern.
 */
export type ContainerWidth =
  | 'narrow'
  | 'medium'
  | 'wide'
  | 'full';

/**
 * A container's internal padding profile — *named* padding
 * intent, resolved at the adapter layer against the
 * platform's spacing model. The four values are design
 * language, not pixel values; the resolver maps them to
 * padding roles through the surface role layer.
 *
 *   - `'none'`         — no internal padding. The container
 *                        is a transparent extent; the consumer
 *                        handles the inner spacing.
 *   - `'tight'`        — minimal padding. Dense content layouts
 *                        (a card grid, a master-detail list).
 *   - `'comfortable'`  — the default padding. Most containers.
 *   - `'spacious'`     — generous padding. Hero sections, page
 *                        intros, content that needs room.
 *
 * Why `ContainerPadding` is a hand-coded union and not
 * derived from `theme.spacing`:
 *   The same reasoning as `ContainerWidth`: a padding
 *   profile is a *consumer intent*, not a primitive step.
 *   The resolver maps the profile to a named padding step
 *   (`'sm'`, `'md'`, `'lg'`, `'none'`) through the role
 *   layer, and the adapter eventually resolves that to a
 *   pixel value. The profile is the contract; the spacing
 *   step is the implementation.
 */
export type ContainerPadding =
  | 'none'
  | 'tight'
  | 'comfortable'
  | 'spacious';

/* ============================================================
 * Accessibility landmark roles
 * ========================================================== */

/**
 * An accessibility landmark metadata — the role a surface
 * carries in the platform's accessibility tree. The value
 * is *metadata only*; the resolver passes it through to
 * the resolved shape, and the adapter translates it into
 * the platform's accessibility attribute.
 *
 *   - `'landmark'`     — the default. A `<div>` on web, a
 *                        `<View>` on RN. No semantic role.
 *   - `'region'`       — a labelled landmark. Web
 *                        `<section aria-labelledby="...">`,
 *                        RN `accessibilityRole="summary"`.
 *   - `'section'`      — a content section. Web
 *                        `<section>`, RN `accessibilityRole="none"`.
 *   - `'article'`      — an independent content block. Web
 *                        `<article>`, RN `accessibilityRole="text"`.
 *   - `'presentation'` — accessible to assistive tech as a
 *                        presentational element only. Web
 *                        `<div role="presentation">`, RN
 *                        `importantForAccessibility="no"`.
 *
 * Why five values and not the full ARIA landmark list:
 *   The five values are the surface-relevant subset of the
 *   ARIA landmark vocabulary. The full list (`banner`, `main`,
 *   `navigation`, `complementary`, `contentinfo`, `form`, etc.)
 *   belongs to a future phase that authors higher-level
 *   layout primitives (page chrome, navigation rails, footer).
 *   A surface primitive does not author "this is the page
 *   main"; it authors "this is a region" and lets a Page
 *   composite consume that.
 */
export type LandmarkRole =
  | 'landmark'
  | 'region'
  | 'section'
  | 'article'
  | 'presentation';