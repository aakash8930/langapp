import { View } from 'react-native';

import { Skeleton, SkeletonGroup } from '@/components/Skeleton';
import { useTheme } from '@/theme';

/**
 * Placeholders shaped like what is coming: the streak's display numeral, the
 * goal bar under it, then the lesson path. Sized from the same tokens the real
 * components use, so the layout does not shift when the data lands.
 */

export function ProgressSkeleton() {
  const theme = useTheme();

  return (
    <SkeletonGroup label="Loading your progress">
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.md }}>
        <Skeleton width={theme.spacing.xxxl * 2} height={theme.fontSize.displayNumber} />
        <View style={{ paddingBottom: theme.spacing.sm }}>
          <Skeleton width={theme.spacing.xxxl * 2} height={theme.fontSize.body} />
        </View>
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <Skeleton height={theme.spacing.xs} radius={theme.radius.pill} />
        <Skeleton width="55%" height={theme.fontSize.small} />
      </View>
    </SkeletonGroup>
  );
}

/** Stands in for the primary callout, which is a solid block either way. */
export function CalloutSkeleton() {
  const theme = useTheme();

  return (
    <Skeleton
      height={theme.controlHeight + theme.spacing.xxl}
      radius={theme.radius.lg}
    />
  );
}

/**
 * The path, before it loads: the continue card, then a chapter heading and a few
 * staggered nodes.
 *
 * Reshaped when the home screen stopped being a list of rows. A skeleton that
 * still drew rows would have been the wrong shape *and* the wrong height, and the
 * layout would jump when the data arrived — which is the one thing skeletons exist
 * to prevent. The sway offsets mirror `UnitChapter`'s `SWAY` so the nodes land
 * where the placeholders were.
 */
const SKELETON_SWAY = [0, 1, 0, -1];
const NODE_SIZE = 56;

export function LessonPathSkeleton({ nodes = 4 }: { nodes?: number }) {
  const theme = useTheme();

  return (
    <SkeletonGroup label="Loading lessons">
      <Skeleton
        height={theme.controlHeight + theme.spacing.xxl}
        radius={theme.radius.lg}
      />

      <View style={{ paddingTop: theme.spacing.xl, gap: theme.spacing.xs }}>
        <Skeleton width="30%" height={theme.fontSize.caption} />
        <Skeleton width="60%" height={theme.fontSize.bodyLarge} />
      </View>

      <View style={{ paddingTop: theme.spacing.lg, gap: theme.spacing.md }}>
        {Array.from({ length: nodes }, (_, node) => (
          <View
            key={node}
            style={{
              alignItems: 'center',
              transform: [
                { translateX: SKELETON_SWAY[node % SKELETON_SWAY.length] * theme.spacing.xxl },
              ],
            }}
          >
            <Skeleton width={NODE_SIZE} height={NODE_SIZE} radius={theme.radius.pill} />
            {node < nodes - 1 ? (
              <View style={{ marginTop: theme.spacing.xs }}>
                <Skeleton width={2} height={theme.spacing.lg} radius={theme.radius.pill} />
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </SkeletonGroup>
  );
}
