/**
 * Elevation scale.
 *
 * Six semantic levels (`none`, `xs`, `sm`, `md`, `lg`, `xl`) and the
 * metadata each level carries. The scale answers a single design
 * question: **how high above the page does this element read?**
 *
 * Why this scale has no numbers in it (yet):
 *   Elevation is the first token subsystem without numeric values.
 *   The numbers — a CSS `box-shadow` string on web, an
 *   `{ shadowOffset, shadowRadius, shadowColor, shadowOpacity,
 *   elevation }` tuple on React Native — belong to the platform
 *   adapter, not to the token. A web shadow on a `none` level is
 *   still `none`; an Android elevation of 24 is not the same
 *   structural idea as a web shadow of `0 4px 12px`. The token
 *   records what an element should *mean*; the adapter decides how
 *   to render that meaning on each platform.
 *
 *   Phase 2.3.4 ships the semantic contract. A later phase will
 *   author `tokens/elevation.web.ts` and `tokens/elevation.native.ts`
 *   — the adapters that turn `elevation.md` into a web box-shadow
 *   or an RN shadow tuple. Until then, no numbers live here.
 *
 * What "elevation" actually is:
 *   - A relative position: an `md` card sits above an `sm` card
 *     and below an `lg` panel.
 *   - A legibility cue: a flat card with a different background
 *     reads as *different*, not as elevated. Drop shadow (or
 *     border contrast) is what makes elevation legible. The
 *     adapter enforces this by always producing a shadow.
 *   - Not theme-dependent. The level of a card does not change
 *     between light and dark mode — only the *tint* of the shadow
 *     changes, and that is a colour-token concern (`shadow.*`),
 *     not an elevation concern.
 *
 * Why elevation is not "emphasis":
 *   A button's emphasis comes from `accent.*`. A card's height
 *   above the page comes from `elevation.*`. The two are different
 *   decisions; conflating them is what produces design systems
 *   that have an `elevation 7` to mean "this is loud". Loud is
 *   not high. If an element wants both, it composes — a button is
 *   `accent.primary` and `elevation.raised`.
 *
 * What the metadata is for:
 *   Each level carries a short label, a sentence describing what
 *   the level is for, and the contract a future adapter must
 *   satisfy (the relative position it sits at on the scale). The
 *   metadata is not decorative — a future `elevations.md` adapter
 *   that renders shadows can `switch (level)` over the union and
 *   pick the right shadow for each one.
 *
 * Tree-shaking:
 *   Every level is its own `export const`. A consumer that imports
 *   only `elevation_md` does not pull `elevation_xl` at runtime;
 *   a bundler with `sideEffects: false` (Phase 2.3+) drops the
 *   unused levels from the output bundle.
 *
 * Immutability:
 *   The metadata objects are frozen; the assembled `elevation`
 *   record is `Object.freeze`'d at construction. Two layers, by
 *   the same reasoning as spacing and radius.
 */

/**
 * The six semantic elevation levels, in ascending order of height
 * above the page. `none` is deliberately first — flat means *no*
 * elevation, and that is the most common state in a content-heavy
 * design.
 *
 * A future "level above `xl`" is a real possibility — a system
 * overlay, an OS-permission-blocking sheet — but adding one
 * without a measured need is what made older systems grow past
 * twenty levels. The pattern: a new level lands with a real
 * consumer; otherwise the level is not added.
 */
export type ElevationLevel =
  | 'none'
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl';

/**
 * The metadata a single elevation level carries.
 *
 * Three fields, all optional-but-typed (the `?` is intentionally
 * absent on `level` and `description`; `hint` is the one optional
 * field). The shape is what a platform adapter reads when it
 * decides how to render the level on its engine:
 *
 *   - `level` is the same {@link ElevationLevel} literal the
 *     consumer passed in. Recorded on the metadata so a future
 *     adapter that receives the whole record can recover the
 *     input without rebuilding the lookup.
 *   - `description` is the one-sentence "use for" sentence the
 *     design system uses when a contributor asks what the level
 *     is for. The audit script surfaces this in error messages
 *     when a level is misused, so the message names the design
 *     intent rather than the platform's shadow value.
 *   - `hint` is an optional orientation note for the adapter
 *     ("the shadow falls predominantly below the element", "the
 *     shadow is broad and soft"). The same hint applies to
 *     multiple levels, but the levels themselves are not "the
 *     soft hint"; the level is the role, the hint is the
 *     rendering direction.
 */
export interface ElevationLevelMeta {
  readonly level: ElevationLevel;
  readonly description: string;
  readonly hint?: string;
}

/* ============================================================================
 * Leaves — one `export const` per level.
 *
 * Every level is its own export so consumers can deep-import a
 * single entry (e.g. `import { elevation_md } from
 * '@genko/design/tokens/elevation'`) without pulling the rest. The
 * aliases in `tokens/index.ts` give every leaf a `elevationMd`
 * PascalCase name too.
 * ========================================================================== */

/**
 * `elevation.none` — flat surfaces.
 *
 * An element that sits flush with the page. A divider, a status
 * row, the page itself. No shadow, no lift. The deliberate
 * flat state.
 *
 * Adapter contract: render no shadow. The element's background
 * colour is its only signal — and a `none` element on a `none`
 * page is invisible by design, which is the right answer for a
 * divider but the wrong answer for a button (a button wants at
 * least `xs`).
 */
export const elevation_none: ElevationLevelMeta = Object.freeze({
  level: 'none',
  description: 'Flat surfaces. No shadow, no lift. The page itself, a divider, a status row.',
});

/**
 * `elevation.xs` — subtle separation.
 *
 * The smallest lift. A card that wants a hair of distinction from
 * the page without committing to "this is a card"; a settings row
 * that wants a touch of separation from the row above it.
 *
 * Adapter contract: a very soft shadow. A future adapter's
 * "subtle" hint maps here. A consumer that reaches for `xs` on an
 * interactive control should consider `sm` instead — `xs` reads
 * as "barely there", not "pressable".
 */
export const elevation_xs: ElevationLevelMeta = Object.freeze({
  level: 'xs',
  description: 'Subtle separation. A hair of distinction from the page.',
  hint: 'Very soft shadow; the element is barely lifted.',
});

/**
 * `elevation.sm` — cards.
 *
 * The default resting card. The level most surfaces reach for
 * when they have no opinion. A settings card, a list-item card,
 * a content card on a feed.
 *
 * Adapter contract: a small, low-contrast shadow that reads as
 * "this is a card". A consumer that wants a *raised* card (a
 * card on a card) should reach for `md` — `sm` is for cards on
 * the page.
 */
export const elevation_sm: ElevationLevelMeta = Object.freeze({
  level: 'sm',
  description: 'Cards. The default resting card; a content card on a feed.',
  hint: 'Small, low-contrast shadow. Reads as "this is a card".',
});

/**
 * `elevation.md` — floating panels.
 *
 * An element that sits above a card. A tooltip, a popover menu,
 * a contextual panel that appears anchored to a trigger. The
 * first level that reads as "this is on top of something".
 *
 * Adapter contract: a medium-strength shadow with a clear
 * offset. The element has visibly moved away from the surface
 * it sits on.
 */
export const elevation_md: ElevationLevelMeta = Object.freeze({
  level: 'md',
  description: 'Floating panels. A tooltip, a popover menu, an anchored panel.',
  hint: 'Medium shadow with a visible offset. Reads as "on top of something".',
});

/**
 * `elevation.lg` — dialogs.
 *
 * A modal, a centred dialog, a bottom drawer that anchors to the
 * page rather than to an element. The first level that should
 * block the surface beneath it.
 *
 * Adapter contract: a strong shadow. The element reads as
 * detached from the page. Pairs with `overlay.scrim` on
 * screens that dim the rest of the page behind the dialog;
 * `lg` is the level, the scrim is the colour, and the
 * `zIndex.overlay` is the layer they share.
 */
export const elevation_lg: ElevationLevelMeta = Object.freeze({
  level: 'lg',
  description: 'Dialogs. A modal, a centred dialog, a bottom drawer.',
  hint: 'Strong shadow. The element is visibly detached from the page.',
});

/**
 * `elevation.xl` — overlays.
 *
 * The largest visible lift on the screen. A blocking
 * system-level overlay, a confirmation sheet that pre-empts
 * the whole page, an OS-permission prompt.
 *
 * Adapter contract: the strongest shadow the design uses.
 * Paired with `zIndex.critical`. A consumer should rarely
 * reach for `xl` — if a screen has more than one `xl`
 * element visible at once, the two are competing and one
 * should drop to `lg`.
 */
export const elevation_xl: ElevationLevelMeta = Object.freeze({
  level: 'xl',
  description: 'Overlays. A blocking system-level overlay; an OS-permission prompt.',
  hint: 'Strongest shadow. The element pre-empts the whole page.',
});

/* ============================================================================
 * Assembled scale
 * ========================================================================== */

/**
 * The elevation scale as a single readonly object.
 *
 * Keys are the {@link ElevationLevel} union; values are the
 * metadata records the leaves above expose. The shape
 * `Readonly<Record<ElevationLevel, ElevationLevelMeta>>` is a
 * contract:
 *
 *   - Every level in {@link ElevationLevel} must have a value
 *     here. A missing key is a TS error.
 *   - The values cannot be reassigned at the object level (the
 *     `Readonly<…>` wrapper prevents that), and the leaves are
 *     frozen with `Object.freeze` so a runtime write like
 *     `elevation.md = { ... }` throws or silently fails
 *     (depending on strict mode).
 *   - Adding a new level is one line in {@link ElevationLevel},
 *     one frozen const above, and one entry in this object.
 *     Forgetting any of the three is a TS error.
 *
 * Consumers read this object via the `elevation.*` path a
 * future `useTheme()` hook will expose (`theme.elevation.md`).
 * For tests and direct access today, the object is also
 * exported from `tokens/index.ts` as the `elevation` named
 * export.
 */
export const elevation: Readonly<Record<ElevationLevel, ElevationLevelMeta>> =
  Object.freeze({
    none: elevation_none,
    xs: elevation_xs,
    sm: elevation_sm,
    md: elevation_md,
    lg: elevation_lg,
    xl: elevation_xl,
  });

/**
 * The {@link ElevationLevel} union is **not** aliased to `Elevation`
 * the way `Spacing` and `Radius` aliased their step unions.
 *
 * The reason: a future prop named `elevation: Elevation` would
 * shadow the React prop of the same name on `View` (Android's
 * native elevation prop), and the shadowing would silently change
 * meaning at the call site. Keeping the union as
 * {@link ElevationLevel} avoids the collision entirely.
 *
 * Consumers that want to type a prop as "any elevation level"
 * write it as `elevation: ElevationLevel`. If a future phase
 * adds a value-vs-level split (the level name vs a typed
 * metadata record), it lands as a second type, not an alias.
 */