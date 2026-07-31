/**
 * Layout primitives — public barrel.
 *
 * Five primitives, all in this phase:
 *   - `Box`     — generic layout container.
 *   - `Flex`    — flex container, extends Box.
 *   - `Stack`   — single-axis flex container, extends Flex.
 *   - `Spacer`  — flex-grow utility.
 *   - `Divider` — semantic separator.
 *
 * The barrel re-exports:
 *   - Each primitive's `*Props` interface (input contract).
 *   - Each primitive's `resolve*` function (the resolver).
 *   - The resolved shapes (`ResolvedBox`, `ResolvedFlex`,
 *     `ResolvedSpacer`, `ResolvedDivider`).
 *   - The shared unions (`SurfaceKey`, `PaddingStep`,
 *     `RadiusStepKey`, `BorderLevelKey`,
 *     `ElevationLevelKey`, `FlexDirection`, `FlexAlign`,
 *     `FlexJustify`, `FlexWrap`, `DividerOrientation`,
 *     `SpacerAxis`).
 *
 * Import shape:
 *   import {
 *     BoxProps,
 *     FlexProps,
 *     StackProps,
 *     SpacerProps,
 *     DividerProps,
 *
 *     resolveBox,
 *     resolveFlex,
 *     resolveStack,
 *     resolveSpacer,
 *     resolveDivider,
 *
 *     ResolvedBox,
 *     ResolvedFlex,
 *     ResolvedSpacer,
 *     ResolvedDivider,
 *
 *     SurfaceKey,
 *     PaddingStep,
 *     // ... and the rest of the unions
 *   } from '@genko/design/components/layout';
 *
 * The barrel does not export the resolver internals
 * (`resolvePalettePath`, `resolvePaddingStep`, etc. from
 * `box.ts`) — those are private to the file they live in.
 * A consumer that needs a step-to-pixel helper imports
 * the role layer or the primitive scale directly.
 *
 * Why no `Box`, `Flex`, `Stack` constants / classes:
 *   These are describe-and-resolve contracts. They are not
 *   React components (no JSX, no React import); they are
 *   also not class instances (no `new Box()`). The export
 *   shape is *type + resolver function*. A future platform
 *   adapter (Phase 2.4+) wraps the resolver into a
 *   `<Box>` React component; the contract does not
 *   prescribe the wrapper.
 */

export type {
  BoxProps,
} from './box';

export type {
  FlexProps,
} from './flex';

export type {
  StackProps,
  StackDirection,
} from './stack';

export type {
  SpacerProps,
} from './spacer';

export type {
  DividerProps,
} from './divider';

export type {
  ResolvedBox,
} from './resolved-box';

export type {
  ResolvedFlex,
  ResolvedBorder,
  ResolvedDivider,
  ResolvedSpacer,
  ResolvedSurface,
  ResolverPalette,
} from './resolved';

export {
  resolveBox,
} from './box';

export {
  resolveFlex,
} from './flex';

export {
  resolveStack,
} from './stack';

export {
  resolveSpacer,
} from './spacer';

export {
  resolveDivider,
} from './divider';

export type {
  SurfaceKey,
  PaddingStep,
  RadiusStepKey,
  BorderLevelKey,
  ElevationLevelKey,
  FlexDirection,
  FlexAlign,
  FlexJustify,
  FlexWrap,
  DividerOrientation,
  SpacerAxis,
} from './types';