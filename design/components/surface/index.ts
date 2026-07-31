/**
 * Surface primitives — public barrel.
 *
 * Three primitives in this phase:
 *   - `Surface`    — the visual foundation.
 *   - `Card`       — composes Surface; adds a variant.
 *   - `Container`  — composes Surface; adds width and padding profiles.
 *
 * The barrel re-exports:
 *   - Each primitive's `*Props` interface (input contract).
 *   - Each primitive's `resolve*` function (the resolver).
 *   - The resolved shapes (`ResolvedSurface`, `ResolvedCard`,
 *     `ResolvedContainer`).
 *   - The shared unions (`SurfaceKey`, `BorderLevelKey`,
 *     `ElevationLevelKey`, `CardVariant`, `ContainerWidth`,
 *     `ContainerPadding`, `LandmarkRole`).
 *
 * Import shape:
 *   import {
 *     SurfaceProps,
 *     CardProps,
 *     ContainerProps,
 *
 *     resolveSurface,
 *     resolveCard,
 *     resolveContainer,
 *
 *     ResolvedSurface,
 *     ResolvedCard,
 *     ResolvedContainer,
 *
 *     CardVariant,
 *     ContainerWidth,
 *     // ... and the rest of the unions
 *   } from '@genko/design/components/surface';
 *
 * The barrel does not export the resolver internals
 * (`resolvePalettePath`, `resolveBorder`, `resolveVariant`,
 * `resolvePaddingProfile`) — those are private to the file
 * they live in. A consumer that needs a step-to-pixel
 * helper imports the role layer or the primitive scale
 * directly.
 *
 * Why no `Surface`, `Card`, `Container` constants / classes:
 *   These are describe-and-resolve contracts. They are not
 *   React components (no JSX, no React import); they are
 *   also not class instances (no `new Surface()`). The export
 *   shape is *type + resolver function*. A future platform
 *   adapter (Phase 2.4+) wraps the resolver into a
 *   `<Surface>` React component; the contract does not
 *   prescribe the wrapper.
 *
 * What's deliberately not exported here:
 *   - The variant-to-(surface, border, elevation) mapping.
 *     The four `CardVariant` values are exported as a union;
 *     the resolver owns the mapping. A future component that
 *     needs the mapping imports the resolver function, not
 *     the constant.
 *   - The padding-profile-to-padding-step mapping. Same
 *     pattern — the union is exported, the mapping is the
 *     resolver's responsibility.
 *   - The role layer. Components consume roles through their
 *     resolver functions, not directly.
 *   - The theme primitives (`tokens/*`). Components never
 *     reach primitives directly. The barrel is the boundary
 *     between component contracts and primitive values.
 */

export type {
  SurfaceProps,
} from './surface';

export type {
  CardProps,
} from './card';

export type {
  ContainerProps,
} from './container';

export type {
  ResolvedSurfaceVisual,
  ResolvedCard,
  ResolvedContainer,
} from './resolved';

export {
  resolveSurface,
} from './surface';

export {
  resolveCard,
} from './card';

export {
  resolveContainer,
} from './container';

export type {
  SurfaceKey,
  BorderLevelKey,
  ElevationLevelKey,
  CardVariant,
  ContainerWidth,
  ContainerPadding,
  LandmarkRole,
} from './types';