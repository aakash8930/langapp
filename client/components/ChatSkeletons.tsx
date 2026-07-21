import { View } from 'react-native';

import { Skeleton, SkeletonGroup } from '@/components/Skeleton';
import { useTheme } from '@/theme';

/** Height of a two-line bubble at `bodyLarge`, plus its vertical padding. */
const BUBBLE_TWO_LINES = 52 + 24;
const BUBBLE_ONE_LINE = 26 + 24;

/**
 * The wait while the tutor answers.
 *
 * A skeleton rather than a spinner, and shaped like the reply it stands in for,
 * so the transcript does not jump when the real thing lands. This one earns its
 * keep more than most: a turn is a real LLM call, which is seconds, and a bare
 * spinner for that long reads as a hang.
 */
export function PendingReplySkeleton() {
  const theme = useTheme();

  return (
    <SkeletonGroup label="The tutor is replying">
      <View style={{ alignSelf: 'flex-start', maxWidth: '88%', gap: theme.spacing.sm }}>
        <Skeleton width={220} height={BUBBLE_TWO_LINES} radius={theme.radius.lg} />
      </View>
    </SkeletonGroup>
  );
}

/** The first load: the session is being created and the opener is on its way. */
export function ChatStartSkeleton() {
  const theme = useTheme();

  return (
    <SkeletonGroup label="Starting the conversation">
      <View style={{ gap: theme.spacing.lg, padding: theme.spacing.xl }}>
        <Skeleton width={180} height={BUBBLE_ONE_LINE} radius={theme.radius.lg} />
        <Skeleton width={240} height={BUBBLE_TWO_LINES} radius={theme.radius.lg} />
      </View>
    </SkeletonGroup>
  );
}
