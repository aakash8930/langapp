/**
 * Public barrel for the assembled themes.
 *
 * Two themes ship in this phase, both as static objects rather than
 * factory calls:
 *   - `lightTheme` — the resolved palette + the shared non-color
 *     primitives.
 *   - `darkTheme` — identical structure; only `colors` and `scheme`
 *     differ.
 *
 * The theme interface, exposed as `Theme`, defines what a consumer
 * can read off any theme object. Every field's type points at the
 * same primitive subsystem that already exports it — so the
 * `Theme` interface is a composition of references, not a
 * re-declaration. Adding a new theme (high-contrast, sepia, a
 * seasonal palette) is a sibling file under `theme/` that follows
 * the same four-file pattern; this barrel grows by one re-export.
 *
 * Tree-shaking:
 *   The two themes are static `const`s. A consumer that imports
 *   only `lightTheme` does not pull `darkTheme` into the output
 *   bundle — and through it, the dark palette — because the two
 *   themes share nothing at the value level. The `sideEffects:
 *   false` flag (a Phase 2.3+ setting on `package.json`) makes this
 *   unconditional. (The non-color primitives *are* shared between
 *   the two themes, but they were already one set of leaves — the
 *   sharing is at the source, not a duplication introduced here.)
 *
 * No React, no Context, no hooks — those land in Phase 2.3+ as
 * `useTheme()`, `ThemeProvider`, and the appearance-detection
 * plumbing. This file is the value layer; the context layer
 * consumes it.
 */

export type { Theme } from './types';

export { lightTheme } from './light';
export { darkTheme } from './dark';

/**
 * Re-export `ColorScheme` from the colour subsystem so a consumer
 * doing a single package-wide import can get the theme type, the
 * two themes, and the scheme union from this barrel alone.
 *
 *   import {
 *     lightTheme,
 *     darkTheme,
 *     type Theme,
 *     type ColorScheme,
 *   } from '@genko/design/theme';
 */
export type { ColorScheme } from '../tokens/colors';

/* ============================================================
 * Semantic roles (Phase 2.3.9)
 * ============================================================ */

/**
 * The roles layer — the final abstraction between primitive
 * tokens and components. Components consume semantic roles
 * (`theme.roles.text.body`, `theme.roles.surface.card`) rather
 * than reaching into primitives (`theme.typography.fontSize.md`,
 * `theme.colors.bg.surface`).
 *
 * The roles are *theme-independent* by design: the colour
 * slots in every role are palette path strings (`'border.focus'`,
 * `'feedback.danger.bg'`), not values. The path strings resolve
 * through whatever `Theme` is in effect — `lightTheme.colors`
 * or `darkTheme.colors` — at the consumer's call site. A single
 * roles object is therefore correct across both schemes; only
 * the values behind the path change.
 *
 * Re-exported from this barrel:
 *   - The `roles` value (the assembled, frozen role tree).
 *   - Every role interface (`TextRole`, `SurfaceRole`, ...,
 *     `Roles`) from `./roles.types.ts` so component code that
 *     types a prop as `TextRole` reaches one place for the
 *     type plus the value.
 *
 *   import {
 *     roles,
 *     type TextRole,
 *     type SurfaceRole,
 *     type Roles,
 *   } from '@genko/design/theme';
 */
export { roles } from './roles';

export type {
  TextRole,
  SurfaceRole,
  BorderRole,
  IconRole,
  StateRole,
  FocusRole,
  ControlRole,
  Roles,
} from './roles.types';
