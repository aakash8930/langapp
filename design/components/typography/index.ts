/**
 * Typography primitives — public barrel.
 *
 * Four primitives in this phase:
 *   - `Text`     — the typography foundation.
 *   - `Heading`  — composes Text; adds heading-hierarchy level.
 *   - `Label`    — composes Text; adds form-control association.
 *   - `Caption`  — composes Text; adds description metadata.
 *
 * The barrel re-exports:
 *   - Each primitive's `*Props` interface (input contract).
 *   - Each primitive's `resolve*` function (the resolver).
 *   - The resolved shapes (`ResolvedTypography`,
 *     `ResolvedHeading`, `ResolvedLabel`, `ResolvedCaption`).
 *   - The shared unions (`TextRoleKey`, `TextToneKey`,
 *     `TextAlignKey`, `TextTruncateKey`, `HeadingLevelKey`).
 *
 * Import shape:
 *   import {
 *     TextProps,
 *     HeadingProps,
 *     LabelProps,
 *     CaptionProps,
 *
 *     resolveText,
 *     resolveHeading,
 *     resolveLabel,
 *     resolveCaption,
 *
 *     ResolvedTypography,
 *     ResolvedHeading,
 *     ResolvedLabel,
 *     ResolvedCaption,
 *
 *     TextRoleKey,
 *     TextToneKey,
 *     // ... and the rest of the unions
 *   } from '@genko/design/components/typography';
 *
 * The barrel does not export the resolver internals
 * (`resolveToneColor` from `text.ts`) — those are private
 * to the file they live in. A consumer that needs a
 * tone-to-palette-path helper imports the role layer or
 * the palette directly.
 *
 * Why no `Text`, `Heading`, `Label`, `Caption` constants /
 * classes:
 *   These are describe-and-resolve contracts. They are not
 *   React components (no JSX, no React import); they are
 *   also not class instances (no `new Text()`). The export
 *   shape is *type + resolver function*. A future platform
 *   adapter (Phase 2.4+) wraps the resolver into a
 *   `<Text>` React component; the contract does not
 *   prescribe the wrapper.
 *
 * What's deliberately not exported here:
 *   - The tone → palette-path mapping. The four `TextToneKey`
 *     values are exported as a union; the resolver owns the
 *     mapping. A future component that needs the mapping
 *     imports the resolver function, not the constant.
 *   - The role layer. Components consume roles through their
 *     resolver functions, not directly. A consumer that
 *     needs a role (e.g. for a custom prop) imports from
 *     `theme/roles.types` directly.
 *   - The theme primitives (`tokens/*`). Components never
 *     reach primitives directly. The barrel is the
 *     boundary between component contracts and primitive
 *     values.
 */

export type {
  TextProps,
} from './text';

export type {
  HeadingProps,
} from './heading';

export type {
  LabelProps,
} from './label';

export type {
  CaptionProps,
} from './caption';

export type {
  ResolvedTypography,
  ResolvedHeading,
  ResolvedLabel,
  ResolvedCaption,
} from './resolved';

export {
  resolveText,
} from './text';

export {
  resolveHeading,
} from './heading';

export {
  resolveLabel,
} from './label';

export {
  resolveCaption,
} from './caption';

export type {
  TextRoleKey,
  TextToneKey,
  TextAlignKey,
  TextTruncateKey,
  HeadingLevelKey,
} from './types';