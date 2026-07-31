/**
 * `Container` — a composite surface primitive for page-level
 * containers.
 *
 * `Container` is `Surface` plus two pieces of consumer-facing
 * metadata: a *width profile* (the content-width intent) and
 * a *padding profile* (the internal-padding intent). Both
 * profiles are *metadata only* — the resolver hands the
 * profile keys through to the resolved shape, and the
 * adapter translates them into the platform's responsive
 * model.
 *
 * Why `Container` composes `Surface` rather than re-declaring
 * the visual contract:
 *   `Container` is `Surface` plus two fields. Re-declaring
 *   the surface-and-palette lookup here would mean *two*
 *   places to keep in lock-step — a future change to the
 *   role-resolution logic would have to land in both.
 *   Composing through `resolveSurface` keeps the visual
 *   logic in one place, and `Container` adds only the width
 *   and padding profile metadata.
 *
 *   The composition is the same shape as `Card` composing
 *   `Surface` and `Heading` composing `Text` — a shallow
 *   composition that adds exactly the new fields.
 *
 * Why `Container` is a primitive and not a styled `Surface`:
 *   `Container` carries *semantic* information that `Surface`
 *   does not. A `Surface` is a visual container; a `Container`
 *   is a page-level container with a defined content-width
 *   and padding profile. The width profile is a *responsive*
 *   decision — "this content reads at narrow width on phone,
 *   wide on tablet" — and the padding profile is the
 *   container's breathing room. Both are metadata the
 *   adapter interprets; neither is a runtime computation.
 *
 * Width profile resolution:
 *   `Container` accepts a `width` prop typed as
 *   `ContainerWidth` (`'narrow' | 'medium' | 'wide' |
 *   'full'`). The resolver hands the profile through to the
 *   resolved shape unchanged; the adapter translates the
 *   profile into the platform's responsive width (CSS
 *   `max-width`, RN `maxWidth`).
 *
 *   Default: `'medium'` — the most common content width.
 *   A consumer that wants a different width passes it
 *   explicitly.
 *
 * Padding profile resolution:
 *   `Container` accepts a `paddingProfile` prop typed as
 *   `ContainerPadding` (`'none' | 'tight' | 'comfortable'
 *   | 'spacious'`). The resolver maps the profile to a
 *   named padding step through a hand-coded switch, then
 *   delegates to `resolveSurface` with the resolved padding
 *   step plus the consumer's override props.
 *
 *   The mapping is:
 *
 *     `'none'`         → padding step `'none'`
 *     `'tight'`        → padding step `'sm'`
 *     `'comfortable'`  → padding step `'md'`
 *     `'spacious'`     → padding step `'lg'`
 *
 *   The mapping is the role-layer decision — what each
 *   padding profile *means* in the design language.
 *
 * Why the padding profile mapping is hand-coded and not
 * derived:
 *   The padding profile vocabulary is a *consumer* choice —
 *   what a designer or developer authoring a container
 *   reaches for. The mapping from profile to padding step
 *   encodes design intent that *no* theme-level role
 *   exposes today. Putting the mapping in the resolver
 *   (rather than in the role layer) keeps the role layer
 *   theme-independent and the profile mapping locally
 *   scoped.
 *
 * Why the *width* profile has no mapping (it is metadata-
 * only) but the *padding* profile does:
 *   A width profile is a responsive constraint the adapter
 *   interprets against the platform's viewport model — a
 *   different concrete pixel value on a phone than on a
 *   tablet. The resolver cannot compute that pixel value
 *   because the resolver does not have the viewport model
 *   (the adapter does). The padding profile, by contrast,
 *   resolves to a named step from the spacing scale — a
 *   *static* pixel value the resolver can determine today.
 *   The two profiles differ in *who* interprets them: the
 *   width profile needs the adapter's viewport model; the
 *   padding profile does not.
 *
 * Override precedence:
 *   A consumer that wants to override the padding profile
 *   passes `padding` explicitly. The override wins over the
 *   profile's mapped step — same pattern as `Surface` and
 *   `Card`. The width profile has no override (it is a
 *   metadata-only profile the adapter interprets directly),
 *   so a consumer that needs a custom width passes `width`
 *   explicitly and the adapter interprets it as the new
 *   profile.
 */

import type { Theme } from '../../theme/types';
import type {
  ContainerWidth,
  ContainerPadding,
  LandmarkRole,
  BorderLevelKey,
  ElevationLevelKey,
} from './types';
import type { ResolvedContainer } from './resolved';
import { resolveSurface } from './surface';
import type { PaddingStep } from '../layout/types';
import type { RadiusStepKey } from '../layout/types';

/* ============================================================
 * Prop contract
 * ========================================================== */

/**
 * The `Container` prop contract.
 *
 * `width` is optional — the default is `'medium'`, the
 * most common content width. `paddingProfile` is optional
 * — the default is `'comfortable'`, the most common
 * padding intent. The other fields (`padding`, `radius`,
 * `elevation`, `border`, `landmark`) flow through
 * `Surface` unchanged, with the resolver applying the
 * profile's defaults first and the override props winning
 * when set.
 *
 * Why `width` and `paddingProfile` are independent props:
 *   A container's content width and its internal padding
 *   are orthogonal design decisions. A page may want
 *   `'wide'` content at `'tight'` padding (a dashboard with
 *   dense cards), or `'narrow'` content at `'spacious'`
 *   padding (a reading view with breathing room). The two
 *   profiles are paired at the call site, not in the
 *   resolver — the resolver carries each through
 *   independently.
 */
export interface ContainerProps {
  /**
   * The content-width profile. The resolver hands the
   * profile through to the resolved shape; the adapter
   * translates the profile into the platform's responsive
   * width.
   *
   * Default: `'medium'` — the most common content width.
   */
  readonly width?: ContainerWidth;

  /**
   * The internal-padding profile. The resolver maps the
   * profile to a named padding step through a hand-coded
   * switch, then composes the visual resolution through
   * `Surface` with the resolved step.
   *
   * Default: `'comfortable'` — the most common padding
   * intent.
   */
  readonly paddingProfile?: ContainerPadding;

  /**
   * Override the padding profile's resolved step. Same
   * semantics as on `Surface`. If unset, the profile's
   * mapped step wins.
   */
  readonly padding?: PaddingStep;

  /**
   * Override the surface role's corner radius. Same
   * semantics as on `Surface`.
   */
  readonly radius?: RadiusStepKey;

  /**
   * Override the surface role's elevation level. Same
   * semantics as on `Surface`.
   */
  readonly elevation?: ElevationLevelKey;

  /**
   * Override the surface role's border level. Same
   * semantics as on `Surface`.
   */
  readonly border?: BorderLevelKey;

  /**
   * The accessibility landmark role. Same semantics as
   * on `Surface`. Default: `'landmark'` — the non-semantic
   * role. A page-level container typically uses
   * `'region'` so screen readers announce it as a
   * labelled landmark.
   */
  readonly landmark?: LandmarkRole;

  /** The active theme — required. */
  readonly theme: Theme;
}

/* ============================================================
 * Resolver
 * ========================================================== */

/**
 * Resolve a `Container` to its rendered shape.
 *
 * The resolver composes `resolveSurface` (which composes
 * the surface-and-palette lookup) and adds the width and
 * padding profile metadata. The width profile is carried
 * through unchanged (the adapter interprets it); the
 * padding profile is mapped to a named padding step
 * through a hand-coded switch, then composed into the
 * `Surface` resolution.
 *
 * Why the width profile is carried through unchanged:
 *   The width profile is a responsive constraint the
 *   adapter interprets against the platform's viewport
 *   model. The resolver cannot compute the concrete pixel
 *   value (the resolver does not have the viewport model);
 *   the adapter does. The resolver hands the profile
 *   through; the adapter interprets it.
 *
 * Why the padding profile is mapped, then composed:
 *   The padding profile resolves to a named step from the
 *   spacing scale — a *static* pixel value the resolver
 *   can determine today. Mapping the profile to a step
 *   keeps the resolver self-contained (it does not need
 *   the adapter's viewport model) and the step is the
 *   same vocabulary `Surface` accepts.
 */
export function resolveContainer(props: ContainerProps): ResolvedContainer {
  // Resolve the width profile. Carried through unchanged —
  // the adapter interprets it.
  const width: ContainerWidth = props.width ?? 'medium';

  // Resolve the padding profile to a named padding step.
  // The mapping is a hand-coded switch — see the file
  // header for the rationale.
  const paddingProfile: ContainerPadding = props.paddingProfile ?? 'comfortable';
  const profilePadding = resolvePaddingProfile(paddingProfile);

  // Compose the visual resolution through `Surface`. The
  // profile's mapped padding step is the *baseline*; the
  // consumer's `padding` override wins when set. The other
  // optional props flow through conditionally — `exactOptional-
  // PropertyTypes` rejects explicit `undefined` against an
  // optional field, so we omit the field entirely when the
  // consumer did not set it.
  const surface = resolveSurface({
    padding: props.padding ?? profilePadding,
    ...(props.radius !== undefined && { radius: props.radius }),
    ...(props.elevation !== undefined && { elevation: props.elevation }),
    ...(props.border !== undefined && { border: props.border }),
    ...(props.landmark !== undefined && { landmark: props.landmark }),
    theme: props.theme,
  });

  // The width and padding profile fields are independent
  // of the visual resolution — metadata the adapter
  // interprets. The resolver carries them through
  // unchanged.
  return Object.freeze({
    ...surface,
    width,
    paddingProfile,
  });
}

/* ============================================================
 * Internal helpers
 * ========================================================== */

/**
 * Map a `ContainerPadding` to a named padding step from
 * the spacing scale. The map is a hand-coded constant —
 * see the file header for the rationale.
 *
 * The mapped step is the *baseline* the consumer's
 * `padding` override wins over. A consumer that wants a
 * `'comfortable'` container with `'tight'` actual padding
 * passes `padding: 'xs'` explicitly; the profile default
 * is the `'md'` step and the override drops to `'xs'`.
 */
function resolvePaddingProfile(
  profile: ContainerPadding,
): PaddingStep {
  switch (profile) {
    case 'none':
      return 'none';
    case 'tight':
      return 'sm';
    case 'comfortable':
      return 'md';
    case 'spacious':
      return 'lg';
  }
}