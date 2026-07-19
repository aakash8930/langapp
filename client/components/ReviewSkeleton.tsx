import { View } from 'react-native';

import { Skeleton, SkeletonGroup } from '@/components/Skeleton';
import { useTheme } from '@/theme';

/** Cell size in GenkouyoushiCell's default. Matched so nothing jumps. */
const CELL_SIZE = 200;

/**
 * The review session mid-load: the count, the manuscript square, the grade
 * strip. Laid out in the screen's real geometry so the first card lands in
 * exactly the space its placeholder occupied.
 */
export function ReviewSkeleton() {
  const theme = useTheme();

  return (
    <SkeletonGroup label="Loading your review session" fill>
      <View style={{ paddingHorizontal: theme.spacing.xl, gap: theme.spacing.sm }}>
        <Skeleton width="30%" height={theme.fontSize.caption} />
        <Skeleton height={theme.spacing.xs} radius={theme.radius.pill} />
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Skeleton width={CELL_SIZE} height={CELL_SIZE} />
      </View>

      <View style={{ paddingHorizontal: theme.spacing.xl }}>
        <Skeleton
          height={theme.controlHeight + theme.spacing.md}
          radius={theme.radius.md}
        />
      </View>
    </SkeletonGroup>
  );
}
