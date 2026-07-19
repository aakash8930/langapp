import { View } from 'react-native';

import { Skeleton, SkeletonGroup } from '@/components/Skeleton';
import { useTheme } from '@/theme';

/** Matches GenkouyoushiCell's default so the character lands where the block was. */
const CELL_SIZE = 200;
const OPTION_COUNT = 4;

/** The exercise screen mid-load: progress, the cell, four answers, the button. */
export function LessonSkeleton() {
  const theme = useTheme();

  return (
    <SkeletonGroup label="Loading this lesson" fill>
      <View style={{ paddingHorizontal: theme.spacing.xl, gap: theme.spacing.sm }}>
        <Skeleton width="25%" height={theme.fontSize.caption} />
        <Skeleton height={theme.spacing.xs} radius={theme.radius.pill} />
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Skeleton width={CELL_SIZE} height={CELL_SIZE} />
      </View>

      <View style={{ paddingHorizontal: theme.spacing.xl, gap: theme.spacing.sm }}>
        {Array.from({ length: OPTION_COUNT }, (_, option) => (
          <Skeleton key={option} height={theme.controlHeight} radius={theme.radius.md} />
        ))}
      </View>
    </SkeletonGroup>
  );
}
