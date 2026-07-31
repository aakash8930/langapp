/**
 * Typography token system.
 *
 * Five independent primitive groups, each exposed as its own
 * assembled `Object.freeze`d object, then composed into a single
 * `typography` namespace for consumers that want to read
 * `theme.typography.fontSize.md` rather than reaching for
 * `theme.fontSize.md`:
 *
 *   1. fontFamily   — ordered fallback chains, four entries:
 *                     `sans` (Latin UI), `mono` (code), and
 *                     `ja` / `jaBold` (Japanese content).
 *   2. fontSize     — seven px steps, xs → 3xl.
 *   3. lineHeight   — seven px values, paired 1:1 with fontSize.
 *   4. fontWeight   — five numeric weights, light → bold.
 *   5. letterSpacing — three em-unit values, tight → wide.
 *
 * Why five groups rather than a single mega-object:
 *   Each decision a designer makes is independent. Changing the
 *   bold weight does not require re-thinking the spacing scale. A
 *   platform adapter for web joins these into CSS declarations on
 *   a `<Text>` element; an RN adapter joins them into the
 *   `style.fontSize`, `style.fontFamily` props the framework
 *   already exposes. The separation is also what makes the brief
 *   constraint workable: semantic roles (Heading, Body, Caption,
 *   …) are compositions of these primitives, and composition lives
 *   in a future phase, not here.
 *
 * Why font families are ordered fallback arrays, not strings:
 *   The actual choice between fonts happens on the device. A
 *   single `string` value would either pre-decide ("always ZenKaku")
 *   or encode platform-specific commas into the token. An ordered
 *   `string[]` is the design's *intent* — "prefer ZenKaku, then
 *   Hiragino, then the system Japanese font, then the system
 *   sans-serif" — which the platform adapter joins with commas
 *   into a CSS `font-family` declaration or passes through to
 *   RN's font-family prop. The token does not pick sides.
 *
 * Why letter-spacing is stored as a `number` in em, not px:
 *   Letter-spacing tracks with font size — a 0.04em value is
 *   approximately 0.64px at size 16, 1.28px at size 32. Storing
 *   px would mean the spacing reads wrong on every size that
 *   isn't the design's reference size. The platform adapter
 *   multiplies against the resolved font size; the token stays
 *   scale-shaped. This is the same reason `motio`n em-units
 *   won't be invented later — the design choices are the
 *   numbers, and em is the unit of the choice.
 *
 * Why numeric font weights:
 *   CSS `font-weight: 600` accepts numbers; RN's `fontWeight`
 *   prop accepts the strings `'600'`. The token is platform-
 *   neutral as a number — the adapter formats it. No weight
 *   strings attached to the design.
 *
 * Why this phase has no `display` sizes or named roles:
 *   Phase 2.2 documented `displayKana` (72), `displayKanji` (56),
 *   `displayNumber` (64) as font-size roles. Those are *role*
 *   decisions (what's the size of a kana glyph on a quiz card),
 *   not primitives — they belong in a future role-composition
 *   phase that picks `fontSize_X` + `lineHeight_X` + a `fontFamily`
 *   per use case. The primitives today scale xs → 3xl because
 *   the brief defines those as the primitive scale.
 *
 * Why no dynamic computation:
 *   `lineHeight.md` is a literal 24, not `fontSize.md * 1.5`. The
 *   brief forbids dynamic calculation, and the values are
 *   well-known enough that hand-tuning beats computation. A
 *   future maintainer can re-tune a single value without
 *   understanding a multiplier.
 *
 * Tree-shaking:
 *   Every leaf is its own `export const`. A consumer that reads
 *   only `fontSize.md` and `fontWeight.semibold` does not pull
 *   `lineHeight`, `letterSpacing`, or the font-family arrays
 *   into the output bundle. The `sideEffects: false` flag (a
 *   future package.json setting) makes this unconditional.
 *
 * Immutability:
 *   Every leaf is `const`. The five assembled objects and the
 *   composing `typography` object are `Object.freeze`d at
 *   construction. Two layers — compile-time and runtime.
 */

/* ============================================================================
 * Group: fontFamily
 * ========================================================================== */

/**
 * Latin / UI sans-serif. The platform system font on mobile, an
 * OS-default on web. A future install of a custom UI font is the
 * single edit that swaps every UI-text surface.
 */
export const fontFamily_sans: readonly string[] = Object.freeze([
  'system-ui',
  '-apple-system',
  'BlinkMacSystemFont',
  'Segoe UI',
  'Roboto',
  'sans-serif',
] as const);

/**
 * Japanese text default. The current mobile surface reads
 * ZenKakuGothicNew; web reads Noto Sans JP. The token is the
 * intent — "prefer the design font, then the OS Japanese font,
 * then the system sans-serif" — and the platform adapter joins
 * the chain into whichever declaration fits.
 */
export const fontFamily_ja: readonly string[] = Object.freeze([
  'ZenKakuGothicNew',
  'Hiragino Sans',
  'Yu Gothic',
  'Noto Sans JP',
  'system-ui',
  'sans-serif',
] as const);

/**
 * Japanese bold. Used for emphasis on Japanese-only surfaces —
 * a card title, a Japanese section heading. The fallback chain
 * follows the same shape as `fontFamily_ja`, with bold-family
 * entries where the OS provides them.
 */
export const fontFamily_jaBold: readonly string[] = Object.freeze([
  'ZenKakuGothicNew-Bold',
  'Hiragino Sans W6',
  'Yu Gothic Bold',
  'Noto Sans JP Bold',
  'system-ui',
  'sans-serif',
] as const);

/**
 * Monospace. Code, fixed-width content, future developer surfaces.
 * The fallback chain prefers JetBrains Mono (the design font when
 * installed), then the OS monospace, then generic.
 */
export const fontFamily_mono: readonly string[] = Object.freeze([
  'JetBrains Mono',
  'SF Mono',
  'Menlo',
  'Monaco',
  'Consolas',
  'monospace',
] as const);

/**
 * The font-family category union. Consumers type props as
 * `family: FontFamilyKey` (the category name) and read the
 * matching index from `fontFamily[key]`.
 */
export type FontFamilyKey =
  | 'sans'
  | 'ja'
  | 'jaBold'
  | 'mono';

/**
 * The assembled font-family scale. Every category is an ordered
 * fallback chain. Read as `fontFamily.ja` for the Japanese chain,
 * `fontFamily.sans` for the Latin UI chain, etc.
 */
export type FontFamily = Readonly<Record<FontFamilyKey, ReadonlyArray<string>>>;

export const fontFamily: FontFamily = Object.freeze({
  sans: fontFamily_sans,
  ja: fontFamily_ja,
  jaBold: fontFamily_jaBold,
  mono: fontFamily_mono,
});

/* ============================================================================
 * Group: fontSize
 * ========================================================================== */

/**
 * 12px — captions, helper text, the smallest readable.
 */
export const fontSize_xs = 12 as const;

/**
 * 14px — secondary text, small UI labels.
 */
export const fontSize_sm = 14 as const;

/**
 * 16px — body default. Never below 16 in interactive content.
 */
export const fontSize_md = 16 as const;

/**
 * 18px — emphasised body, lead paragraphs.
 */
export const fontSize_lg = 18 as const;

/**
 * 22px — card titles, section headings.
 */
export const fontSize_xl = 22 as const;

/**
 * 28px — page headings.
 */
export const fontSize_2xl = 28 as const;

/**
 * 36px — hero numerals, large stat figures. The largest value
 * the primitive scale ships; larger display sizes (displayKana,
 * displayKanji, displayNumber) are role-level decisions composed
 * from these primitives in a future phase.
 */
export const fontSize_3xl = 36 as const;

/**
 * The font-size step union. Consumers type props as
 * `size: FontSizeStep` and read `theme.typography.fontSize.md`.
 */
export type FontSizeStep =
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | '2xl'
  | '3xl';

export type FontSize = Readonly<Record<FontSizeStep, number>>;

export const fontSize: FontSize = Object.freeze({
  xs: fontSize_xs,
  sm: fontSize_sm,
  md: fontSize_md,
  lg: fontSize_lg,
  xl: fontSize_xl,
  '2xl': fontSize_2xl,
  '3xl': fontSize_3xl,
});

/* ============================================================================
 * Group: lineHeight
 * ========================================================================== */

/**
 * 16px — paired with `fontSize_xs`. caption-text rhythm.
 */
export const lineHeight_xs = 16 as const;

/**
 * 20px — paired with `fontSize_sm`. secondary rhythm.
 */
export const lineHeight_sm = 20 as const;

/**
 * 24px — paired with `fontSize_md`. body-text rhythm. The
 * most-used line-height value.
 */
export const lineHeight_md = 24 as const;

/**
 * 26px — paired with `fontSize_lg`. emphasised body rhythm.
 */
export const lineHeight_lg = 26 as const;

/**
 * 30px — paired with `fontSize_xl`. card-title rhythm.
 */
export const lineHeight_xl = 30 as const;

/**
 * 36px — paired with `fontSize_2xl`. page-heading rhythm.
 */
export const lineHeight_2xl = 36 as const;

/**
 * 40px — paired with `fontSize_3xl`. hero-text rhythm.
 */
export const lineHeight_3xl = 40 as const;

/**
 * The line-height step union. Step names mirror `FontSizeStep`
 * deliberately — the pairing is one-to-one, and a consumer that
 * reads `lineHeight[size]` against the same index stays in step.
 */
export type LineHeightStep =
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | '2xl'
  | '3xl';

export type LineHeight = Readonly<Record<LineHeightStep, number>>;

export const lineHeight: LineHeight = Object.freeze({
  xs: lineHeight_xs,
  sm: lineHeight_sm,
  md: lineHeight_md,
  lg: lineHeight_lg,
  xl: lineHeight_xl,
  '2xl': lineHeight_2xl,
  '3xl': lineHeight_3xl,
});

/* ============================================================================
 * Group: fontWeight
 * ========================================================================== */

/**
 * 300. Light. Reserved for display purposes only; the existing
 * design does not use it. Included for completeness because a
 * future role (large numerals on a hero) may want the optical
 * weight reduction. Token is present now so the value is decided
 * here, not at a future call site.
 */
export const fontWeight_light = 300 as const;

/**
 * 400. Regular — body default.
 */
export const fontWeight_regular = 400 as const;

/**
 * 500. Medium — slightly emphasised body, subheadings.
 */
export const fontWeight_medium = 500 as const;

/**
 * 600. Semibold — card titles.
 */
export const fontWeight_semibold = 600 as const;

/**
 * 700. Bold — page headings, the heaviest emphasis.
 */
export const fontWeight_bold = 700 as const;

/**
 * The font-weight step union. Five values, no `thin`/`black`:
 * the current design's content pushes 700 as the maximum, and
 * a token set that doesn't exist doesn't invite "one more
 * emphasis" weight decisions.
 */
export type FontWeightStep =
  | 'light'
  | 'regular'
  | 'medium'
  | 'semibold'
  | 'bold';

/**
 * A numeric weight is a CSS `font-weight` number and an RN
 * `fontWeight` prop value. The platform adapter formats it.
 */
export type FontWeight = Readonly<Record<FontWeightStep, number>>;

export const fontWeight: FontWeight = Object.freeze({
  light: fontWeight_light,
  regular: fontWeight_regular,
  medium: fontWeight_medium,
  semibold: fontWeight_semibold,
  bold: fontWeight_bold,
});

/* ============================================================================
 * Group: letterSpacing
 * ========================================================================== */

/**
 * -0.02 (em units). Display sizes (xl → 3xl); prevents tracking
 * at large scale from looking airy. The platform adapter multiplies
 * against the resolved font size.
 */
export const letterSpacing_tight = -0.02 as const;

/**
 * 0 (em units). Body and below; the default.
 */
export const letterSpacing_normal = 0 as const;

/**
 * 0.04 (em units). Caption-type emphasis (eyebrows, kickers,
 * "new" badges); opens the tracking up so caps read clearly.
 */
export const letterSpacing_wide = 0.04 as const;

/**
 * The letter-spacing step union. Three values — the brief's
 * scale. No `widest`; the design system reserves that for
 * role-level decisions (eyebrows on a hero section), not for
 * a primitive token.
 */
export type LetterSpacingStep =
  | 'tight'
  | 'normal'
  | 'wide';

/**
 * A numeric letter-spacing value in em units. The platform
 * adapter multiplies it against the resolved font size at use.
 */
export type LetterSpacing = Readonly<Record<LetterSpacingStep, number>>;

export const letterSpacing: LetterSpacing = Object.freeze({
  tight: letterSpacing_tight,
  normal: letterSpacing_normal,
  wide: letterSpacing_wide,
});

/* ============================================================================
 * Composition: typography
 * ========================================================================== */

/**
 * The five groups composed into a single namespace. Consumers
 * reach primitives via `theme.typography.fontSize.md`,
 * `theme.typography.fontWeight.semibold`, etc. — without losing
 * the option to address the five groups directly via
 * `theme.fontSize`, `theme.fontWeight`, `theme.lineHeight`,
 * `theme.fontFamily`, `theme.letterSpacing`. Both shapes are valid;
 * the namespaces exist independently so a future role-composition
 * phase can add `theme.typography.role.body` alongside without
 * disturbing the primitives.
 *
 * The composition is built once at module load — `Object.freeze`
 * applies recursively through the references because each child
 * is already frozen, so no deep-freeze helper is needed.
 */
export const typography = Object.freeze({
  fontFamily,
  fontSize,
  lineHeight,
  fontWeight,
  letterSpacing,
});
