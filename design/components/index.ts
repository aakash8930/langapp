/**
 * Components — public barrel.
 *
 * The components layer is the future home of every
 * consumer-facing primitive. In this phase (2.4.1+) it
 * contains the layout primitives (Box, Flex, Stack,
 * Spacer, Divider), the typography primitives (Text,
 * Heading, Label, Caption), and the surface primitives
 * (Surface, Card, Container). Future phases add control
 * primitives (Button, Input), content primitives (Avatar,
 * Badge, Chip), and overlay primitives (Modal, Dialog,
 * Toast, Popover, Sheet, Drawer).
 *
 * The barrel re-exports the layout barrel in its
 * entirety. A consumer that needs any layout primitive
 * imports from one place:
 *
 *   import {
 *     BoxProps,
 *     resolveBox,
 *     StackProps,
 *     resolveStack,
 *   } from '@genko/design/components';
 *
 * Why a top-level `components/index.ts` rather than
 * exporting the layout barrel directly:
 *   Future components (`button/`, `input/`, etc.) live as
 *   siblings of `layout/`. The top-level barrel re-exports
 *   each sub-folder, giving a consumer one import path for
 *   the whole component vocabulary. As the layer grows,
 *   this barrel grows by one re-export per sub-folder;
 *   no consumer-facing change is needed.
 *
 * What's deliberately not exported here:
 *   - The role layer (`theme/roles`). Components consume
 *     roles through their resolver functions, not directly.
 *     A consumer that needs a role (e.g. for a custom
 *     prop) imports from `theme/roles.types` directly.
 *   - The theme primitives (`tokens/*`). Components never
 *     reach primitives directly. The barrel is the
 *     boundary between component contracts and primitive
 *     values.
 *   - The theme assembly (`theme/light`, `theme/dark`).
 *     The runtime Theme provider is what passes the active
 *     theme into a resolver; a component consumer does not
 *     need to import the assembly directly.
 */

export type {
  BoxProps,
  FlexProps,
  StackProps,
  StackDirection,
  SpacerProps,
  DividerProps,

  ResolvedBox,
  ResolvedFlex,
  ResolvedBorder,
  ResolvedDivider,
  ResolvedSpacer,
  ResolvedSurface,
  ResolverPalette,

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
} from './layout';

export {
  resolveBox,
  resolveFlex,
  resolveStack,
  resolveSpacer,
  resolveDivider,
} from './layout';

export type {
  TextProps,
  HeadingProps,
  LabelProps,
  CaptionProps,

  ResolvedTypography,
  ResolvedHeading,
  ResolvedLabel,
  ResolvedCaption,

  TextRoleKey,
  TextToneKey,
  TextAlignKey,
  TextTruncateKey,
  HeadingLevelKey,
} from './typography';

export {
  resolveText,
  resolveHeading,
  resolveLabel,
  resolveCaption,
} from './typography';

export type {
  SurfaceProps,
  CardProps,
  ContainerProps,

  ResolvedSurfaceVisual,
  ResolvedCard,
  ResolvedContainer,

  CardVariant,
  ContainerWidth,
  ContainerPadding,
  LandmarkRole,
} from './surface';

export {
  resolveSurface,
  resolveCard,
  resolveContainer,
} from './surface';