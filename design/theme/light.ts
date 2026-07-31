/**
 * Light theme assembly.
 *
 * The light theme is the composition of:
 *   - the existing `lightPalette` exported from `../tokens/light`
 *   - the non-colour primitives that do not theme (spacing, radius,
 *     motion, typography, elevation-level metadata, border-level
 *     metadata)
 *
 * Nothing here defines a value. Every field is a *reference* to
 * the primitive subsystem's existing export — so when a designer
 * edits `space.md = 16` in `../tokens/spacing.ts`, the change
 * reaches every component on day one without revisiting this
 * file. That is the load-bearing property of the assembly: this
 * layer is thin on purpose, because every line of value-defining
 * code is a line that can drift.
 *
 * Immutability:
 *   The assembled object is `Object.freeze`d at construction. The
 *   leaf references are already frozen (every subsystem ships its
 *   assembled scales frozen), so freezing the outer shell plus the
 *   sub-objects assembled at module load makes the whole tree
 *   recursively immutable — a consumer that mutates
 *   `lightTheme.spacing.md` throws in strict mode at runtime, and
 *   `theme.spacing.md = …` is a TS error at compile time via the
 *   `readonly` annotations on the `Theme` interface in `./types.ts`.
 */

import { lightPalette } from '../tokens/light';
import { space } from '../tokens/spacing';
import { radius } from '../tokens/radius';
import {
  border_none,
  border_subtle,
  border_default,
  border_strong,
  border_focus,
} from '../tokens/borders';
import {
  elevation_none,
  elevation_xs,
  elevation_sm,
  elevation_md,
  elevation_lg,
  elevation_xl,
} from '../tokens/elevation';
import { duration, easing } from '../tokens/motion';
import { typography } from '../tokens/typography';
import { roles } from './roles';

import type { Theme } from './types';

/**
 * The light theme. Every field is the same reference a future
 * theme (high-contrast, sepia, dyslexia-friendly, seasonal) will
 * reuse for non-colour primitives.
 *
 * Notes on a few specific fields:
 *   - `scheme: 'light'` is a literal, not a string variable. The
 *     `ColorScheme` type narrows the literal to `'light'` so a
 *     consumer reading `theme.scheme` gets the exact value at
 *     the type level.
 *   - `border` and `elevation` are assembled at module load from
 *     the per-level leaf exports — same pattern as the other
 *     subsystems, which compose their leaves into a frozen
 *     Record. This keeps leaf-level tree-shaking working: a
 *     future consumer that imports only `lightTheme.border.focus`
 *     does not pull `border.none` (or any other level) into the
 *     output bundle. The leaf-level `export const` shape is what
 *     enables that.
 */
/**
 * Two of the sub-objects are constructed at assembly time
 * (`border`, `elevation`) and need to be frozen explicitly so
 * the entire theme is recursively immutable. The remaining
 * fields reference already-frozen leaves from their subsystems,
 * which Object.freeze on the outer shell keeps untouched but
 * still references immutable objects underneath.
 */
export const lightTheme: Theme = Object.freeze({
  scheme: 'light',
  colors: lightPalette,
  spacing: space,
  radius,
  border: Object.freeze({
    none: border_none,
    subtle: border_subtle,
    default: border_default,
    strong: border_strong,
    focus: border_focus,
  }),
  elevation: Object.freeze({
    none: elevation_none,
    xs: elevation_xs,
    sm: elevation_sm,
    md: elevation_md,
    lg: elevation_lg,
    xl: elevation_xl,
  }),
  motion: Object.freeze({
    duration,
    easing,
  }),
  typography,
  roles,
});
