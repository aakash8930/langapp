/**
 * Semantic role type contracts.
 *
 * This file declares the *shape* of the design-system role layer —
 * what named fields exist, what types each role composes from the
 * underlying primitives, what a consumer autocomplete reveals. It
 * holds no values. Every type reference resolves to a type already
 * exported from `../tokens/*` or from `./types.ts`, so the role
 * interfaces are a composition of references rather than a parallel
 * declaration surface.
 *
 * Why roles get their own type file rather than living next to the
 * values in `roles.ts`:
 *   Two consumers want the role contracts independently of the
 *   values — a component that reads `theme.roles.text.body` wants
 *   the *type* of that path even before the runtime values resolve,
 *   so an IDE surfaces the field shape; a future PropTypes-ish
 *   docgen pass wants the types to import. Splitting types from
 *   values keeps both surfaces small.
 *
 * Why role fields are typed as *path-string unions*, not as the
 * group interfaces themselves:
 *   `SurfaceRole.background` is a *string key* like `'bg.surface'`
 *   that the runtime uses to look up `theme.colors.bg.surface` —
 *   not the value. The right type for the slot is therefore the
 *   union of valid path strings, derived via TS template-literal
 *   types from the existing group interfaces in `colors.ts`
 *   (`keyof BgGroup`, `keyof FgGroup`, `keyof BorderGroup`,
 *   `keyof FeedbackGroup`). One source of truth for "what keys a
 *   palette group exposes" — the `colors.ts` group interfaces —
 *   feeds directly into the role slot unions here.
 *
 * Why a `[K in keyof X]: 'prefix.' + K` template literal works:
 *   Both forms are well-known TS patterns and resolve at the type
 *   level. `keyof BorderGroup` yields `'border' | 'borderStrong'
 *   | 'borderFocus'` (matching the names `colors.ts` chose), and
 *   `${'border.'}${K}` yields `'border.border' | 'border.
 *   borderStrong' | 'border.borderFocus'`. Those are exactly the
 *   path strings the palette exposes, and a value of any other
 *   shape is a TS error against the role.
 *
 * No literals appear in this file except the template-literal
 * prefixes.
 */

import type {
  Palette,
  FeedbackGroup,
} from '../tokens/colors';
import type {
  FontSize,
  LineHeight,
  FontWeight,
  LetterSpacing,
  FontFamilyKey,
} from '../tokens/typography';
import type { SpacingScale } from '../tokens/spacing';
import type { RadiusScale } from '../tokens/radius';
import type { ElevationLevel } from '../tokens/elevation';
import type { BorderLevel } from '../tokens/borders';

/* ============================================================
 * Palette path unions — derived from the existing palette
 * group interfaces.
 *
 * These are template-literal types that compose with
 * `keyof <group>` to yield the union of valid path strings
 * the palette exposes. A consumer reading a role slot's
 * type gets exactly the path strings that resolve to a real
 * value at use time.
 * ========================================================== */

type BgPath = `bg.${keyof Palette['bg']}`;
type FgPath = `fg.${keyof Palette['fg']}`;
type BorderPath = `border.${keyof Palette['border']}`;
type FeedbackKey = keyof FeedbackGroup;

/* ============================================================
 * Text role
 * ========================================================== */

/**
 * A semantic text style — five composed primitives plus a font
 * family key. Every consumer that reads a text role gets exactly
 * what a real text-block needs: a size, a line, a weight, a
 * tracking value, and a font family group name.
 *
 * Note on the font-family field: this is the *group key*, not
 * the array. The component resolves `family: 'sans'` to
 * `theme.typography.fontFamily.sans` at use time; storing the
 * group key keeps the type string-literal and small.
 */
export interface TextRole {
  readonly fontSize: FontSize['md'];
  readonly lineHeight: LineHeight['md'];
  readonly fontWeight: FontWeight['regular'];
  readonly letterSpacing: LetterSpacing['normal'];
  readonly family: FontFamilyKey;
}

/* ============================================================
 * Surface role
 * ========================================================== */

/**
 * A semantic surface — a colour slot for the surface, an
 * elevation level (so a card-vs-tooltip-vs-overlay distinction
 * lives at the role layer, not duplicated at every component),
 * a spacing value the role considers its natural internal
 * padding, and a radius for the corner intent.
 *
 * `background` is a `bg.*` path string the runtime resolves
 * through `theme.colors.bg[path]`. The union comes from
 * `keyof Palette['bg']`, so a value like `bg.thisDoesNotExist`
 * is a compile error.
 *
 * `padding` is a single value (the role's *natural* padding,
 * the one most components start with) rather than a
 * left/right/top/bottom tuple — the role stays a vocabulary,
 * not a layout object. A component that needs asymmetric
 * padding reads the role's `padding` and chooses how to apply.
 */
export interface SurfaceRole {
  readonly background: BgPath;
  readonly elevation: ElevationLevel;
  readonly padding: SpacingScale['md'];
  readonly radius: RadiusScale['md'];
}

/* ============================================================
 * Border role
 * ========================================================== */

/**
 * A semantic border role. The colour slot maps to the colour
 * subsystem's `border.*` group; the level maps to the borders
 * subsystem's five-level metadata scale. The two combine at
 * render time — the platform adapter turns `BorderRole` into a
 * real border by reading both slots.
 *
 * Note that `colors.ts`'s `BorderGroup` exposes its three
 * values as `border | borderStrong | borderFocus` (matching
 * the brief's reduced vocabulary), so the `BorderPath` union
 * surfaces those three keys directly.
 */
export interface BorderRole {
  readonly color: BorderPath;
  readonly level: BorderLevel;
}

/* ============================================================
 * Icon role
 * ========================================================== */

/**
 * A semantic icon role. The colour slot uses `fg.*` because
 * icons are foreground glyphs (drawn *on* a surface, not as a
 * surface themselves); the size slot takes a spacing value
 * because icon sizes share the design's scale intent — an icon
 * at `space.md` reads the same as a card with `space.md`
 * internal padding. Future iconography categories will reuse
 * this shape.
 */
export interface IconRole {
  readonly color: FgPath;
  readonly size: SpacingScale['md'];
}

/* ============================================================
 * State role
 * ========================================================== */

/**
 * A semantic state role — `success`, `warning`, `error`, or
 * `info`. Each role composes the four state slots a real
 * feedback surface needs: a background, a foreground
 * (typically the icon stroke), a border, and a body-text
 * colour.
 *
 * The state role is a *function* of the FeedbackGroup shape —
 * not a parallel declaration. A future addition to
 * FeedbackGroup (e.g. a fifth state like `feedback.tip`)
 * propagates automatically because no field here lists the
 * states by name; the `FeedbackKey` union (`keyof
 * FeedbackGroup`) tracks whatever keys the group exposes.
 *
 * Mapping: `Roles.state.error` resolves against the
 * `feedback.danger.*` palette entries — the colour
 * subsystem calls that state `danger`, while the role
 * layer calls it `error` (the consumer-facing name).
 * `Roles.state[FeedbackKey]` keeps the index signature
 * well-typed.
 */
export interface StateRole {
  readonly background: `feedback.${FeedbackKey}.bg`;
  readonly foreground: `feedback.${FeedbackKey}.fg`;
  readonly border: `feedback.${FeedbackKey}.border`;
  readonly text: `feedback.${FeedbackKey}.fg`;
}

/* ============================================================
 * Focus role
 * ========================================================== */

/**
 * A semantic focus role — the visual treatment an element
 * receives when it is keyboard-focused. `default` is the
 * general-purpose treatment; `keyboard` is the same treatment,
 * made explicit so a future enhancement (e.g. an icon-only
 * variant or a high-contrast variant) can read from a
 * different slot without renaming the general-purpose one.
 *
 * The role is currently the same shape as `default` —
 * `keyboard` exists as a named slot, not a parallel
 * declaration. When the two diverge, only the runtime values
 * in `roles.ts` change.
 *
 * `color` resolves against `Palette['border']` keys; today
 * the only focus value is `border.borderFocus` (the
 * `BorderGroup` key name is `borderFocus`, the path string
 * is `border.borderFocus`), so `BorderPath` is the right
 * slot type.
 */
export interface FocusRole {
  readonly color: BorderPath;
  readonly width: SpacingScale['xs'];
}

/* ============================================================
 * Control role
 * ========================================================== */

/**
 * A semantic control role — the layout slot a real input or
 * button needs. Three values: height, padding (the internal
 * horizontal padding an input or button applies), and radius
 * (the corner-rounding intent).
 *
 * No colour slot here: a control's colour comes from its
 * `surface.*` role and its `state.*` role, not from this
 * layer. Mixing colour into control shape would mean every
 * control needed a colour-pinned shape — which is the wrong
 * invariant (a primary button and a secondary button share
 * shape; they differ in colour).
 */
export interface ControlRole {
  readonly height: SpacingScale['xl'];
  readonly padding: SpacingScale['sm'];
  readonly radius: RadiusScale['md'];
}

/* ============================================================
 * Composed roles object
 * ========================================================== */

/**
 * The complete semantic role layer — the final abstraction
 * between primitive tokens and components. Every field is one
 * of the role interfaces above; values come from `roles.ts`,
 * which references existing primitives.
 *
 * Why this is the *only* role type and not per-component
 * generics:
 *   A consumer reads `theme.roles.text.body` and gets the
 *   shape. A `<Button>` component does not need
 *   `<ButtonRole>`; it needs the same `TextRole` an input's
 *   label uses, and a `ControlRole`, and a `StateRole` for
 *   its pressed/disabled treatment. Per-component generics
 *   would force every component to declare its own role
 *   vocabulary and immediately diverge. One shared role
 *   vocabulary is the property that makes "design-system"
 *   mean something.
 *
 * Why `state` lists its four members inline rather than as a
 * `Record<FeedbackKey, StateRole>`:
 *   The four named roles are part of the public API; a
 *   consumer reads `theme.roles.state.success`, not
 *   `theme.roles.state[feedbackKey]`. Listing them inline
 *   keeps autocomplete and rename-refactor behaviour
 *   identical to every other role group. The cost is a
 *   manual union when adding a fifth state — a one-line
 *   edit in two places (`Roles.state` and the four-key
 *   `FeedbackKey` union, which tracks automatically).
 */
export interface Roles {
  readonly text: {
    readonly body: TextRole;
    readonly heading: TextRole;
    readonly caption: TextRole;
    readonly label: TextRole;
    readonly code: TextRole;
  };

  readonly surface: {
    readonly page: SurfaceRole;
    readonly card: SurfaceRole;
    readonly elevated: SurfaceRole;
    readonly overlay: SurfaceRole;
  };

  readonly border: {
    readonly default: BorderRole;
    readonly focus: BorderRole;
  };

  readonly icon: {
    readonly default: IconRole;
    readonly muted: IconRole;
    readonly accent: IconRole;
  };

  readonly state: {
    readonly success: StateRole;
    readonly warning: StateRole;
    readonly error: StateRole;
    readonly info: StateRole;
  };

  readonly focus: {
    readonly default: FocusRole;
    readonly keyboard: FocusRole;
  };

  readonly control: ControlRole;
}
