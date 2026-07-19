import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchLessons } from '@/api/lessons';
import { fetchProgress } from '@/api/progress';
import { useAuth } from '@/components/AuthProvider';
import { ErrorState } from '@/components/ErrorState';
import {
  CalloutSkeleton,
  LessonListSkeleton,
  ProgressSkeleton,
} from '@/components/HomeSkeletons';
import { LessonRow } from '@/components/LessonRow';
import { ProgressSummary } from '@/components/ProgressSummary';
import { ReviewCallout, ReviewEmptyState } from '@/components/ReviewCallout';
import { withLockState, type LessonWithState } from '@/lib/lessons';
import { useTheme } from '@/theme';

/** Phase 0 ships one unit. When there is a second, this becomes a picker. */
const UNIT = 'hiragana-basics';

export default function Home() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const progress = useQuery({
    queryKey: ['progress'],
    queryFn: fetchProgress,
    // XP, streak and the due count all move while the user is elsewhere in the
    // app, so this screen always re-asks on arrival and shows the cached copy
    // underneath while it does.
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const lessons = useQuery({
    queryKey: ['lessons', UNIT],
    queryFn: () => fetchLessons(UNIT),
    // Lesson content is seeded and effectively static; only its lock state
    // moves, and that comes from the progress query above.
    staleTime: 5 * 60_000,
  });

  const refreshing = progress.isRefetching || lessons.isRefetching;

  function refetchAll() {
    void progress.refetch();
    void lessons.refetch();
  }

  const withState: LessonWithState[] =
    progress.data && lessons.data
      ? withLockState(lessons.data, progress.data.completedLessonIds)
      : [];

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        padding: theme.spacing.xl,
        paddingTop: insets.top + theme.spacing.xl,
        paddingBottom: insets.bottom + theme.spacing.xl,
        gap: theme.spacing.xxl,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refetchAll}
          tintColor={theme.colors.inkSoft}
        />
      }
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.lg,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            flexShrink: 1,
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.body,
            color: theme.colors.inkSoft,
          }}
        >
          {user ? user.profile.displayName : 'Signed in'}
        </Text>
        <SettingsLink onPress={() => router.push('/settings')} />
      </View>

      {progress.isPending ? (
        <>
          <ProgressSkeleton />
          <CalloutSkeleton />
        </>
      ) : progress.isError ? (
        <ErrorState error={progress.error} onRetry={refetchAll} />
      ) : (
        <>
          <ProgressSummary progress={progress.data} />

          {progress.data.cardsDueNow > 0 ? (
            <ReviewCallout
              count={progress.data.cardsDueNow}
              onPress={() => router.push('/review')}
            />
          ) : (
            <ReviewEmptyState hasStarted={progress.data.lessonsCompleted > 0} />
          )}
        </>
      )}

      <View style={{ gap: theme.spacing.sm }}>
        <Text
          style={{
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.caption,
            color: theme.colors.inkSoft,
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          Hiragana basics
        </Text>

        {lessons.isPending ? (
          <LessonListSkeleton />
        ) : lessons.isError ? (
          <View style={{ paddingTop: theme.spacing.md }}>
            <ErrorState error={lessons.error} onRetry={refetchAll} />
          </View>
        ) : withState.length === 0 ? (
          <EmptyLessons />
        ) : (
          withState.map((lesson) => (
            <LessonRow
              key={lesson.id}
              lesson={lesson}
              onPress={(next) => router.push(`/lesson/${next.id}`)}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

/**
 * The unit seeded empty. Not a dead end: it names the exact command that fills
 * it, because the only person who will ever see this is the one who can run it.
 */
function EmptyLessons() {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.sm, paddingTop: theme.spacing.md }}>
      <Text
        style={{
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.bodyLarge,
          color: theme.colors.ink,
        }}
      >
        No lessons loaded yet
      </Text>
      <Text
        style={{
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.body,
          lineHeight: theme.lineHeight.body,
          color: theme.colors.inkSoft,
        }}
      >
        Run `npm run seed` in the API to load the Japanese content pack, then pull down
        to refresh.
      </Text>
    </View>
  );
}

function SettingsLink({ onPress }: { onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Settings"
      hitSlop={theme.spacing.md}
      style={({ pressed }) => ({
        paddingVertical: theme.spacing.sm,
        paddingLeft: theme.spacing.lg,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text
        style={{
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.body,
          color: theme.colors.ai,
        }}
      >
        Settings
      </Text>
    </Pressable>
  );
}
