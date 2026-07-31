/**
 * Dark theme assembly.
 *
 * Structurally identical to `light.ts` — same references to the
 * same primitive subsystems, only `colors` swaps to `darkPalette`
 * and `scheme: 'dark'` is the literal. A consumer reading
 * `darkTheme.spacing.md` and `lightTheme.spacing.md` gets the
 * exact same `number`, by construction.
 *
 * Why the two assembly files exist as siblings rather than as
 * one factory:
 *   A factory (`buildTheme({ scheme })`) seems DRY on paper but
 *   pays its own costs — every site that wants to import a
 *   static theme pays a function call, a parameter shape to
 *   remember, and (under hot-module-reload) a fresh object. Two
 *   static assemblies are clearer: the file you import from
 *   names the theme, the type system knows the literal scheme,
 *   and the bundler can drop one when only the other is used.
 *
 * A future theme (high-contrast, sepia, dyslexia-friendly,
 * seasonal) lands as a sibling — same four-file pattern, just a
 * new palette reference. The non-colour fields do not change.
 */

import { darkPalette } from '../tokens/dark';
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
 * Two of the sub-objects are constructed at assembly time
 * (`border`, `elevation`) and need to be frozen explicitly so
 * the entire theme is recursively immutable. The remaining
 * fields reference already-frozen leaves from their subsystems.
 */
export const darkTheme: Theme = Object.freeze({
  scheme: 'dark',
  colors: darkPalette,
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
