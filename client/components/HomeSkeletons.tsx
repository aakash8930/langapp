import { View } from 'react-native';

import { Skeleton, SkeletonGroup } from '@/components/Skeleton';
import { useTheme } from '@/theme';

/**
 * Placeholders shaped like what is coming: the streak's display numeral, the
 * goal bar under it, then lesson rows. Sized from the same tokens the real
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

/** Stands in for the review callout, which is a solid block either way. */
export function CalloutSkeleton() {
  const theme = useTheme();

  return (
    <Skeleton
      height={theme.controlHeight + theme.spacing.xxl}
      radius={theme.radius.lg}
    />
  );
}

export function LessonListSkeleton({ rows = 3 }: { rows?: number }) {
  const theme = useTheme();

  return (
    <SkeletonGroup label="Loading lessons">
      {Array.from({ length: rows }, (_, row) => (
        <View
          key={row}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.lg,
            paddingVertical: theme.spacing.lg,
          }}
        >
          <Skeleton width={theme.spacing.lg} height={theme.spacing.lg} />
          <View style={{ flex: 1, gap: theme.spacing.sm }}>
            <Skeleton width="70%" height={theme.fontSize.body} />
            <Skeleton width="40%" height={theme.fontSize.small} />
          </View>
        </View>
      ))}
    </SkeletonGroup>
  );
}
