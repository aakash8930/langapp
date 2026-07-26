import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchLessons } from '@/api/lessons';
import { fetchProgress } from '@/api/progress';
import { useAuth } from '@/components/AuthProvider';
import { ChatCallout } from '@/components/ChatCallout';
import { ContinueCard, CourseComplete } from '@/components/ContinueCard';
import { ErrorState } from '@/components/ErrorState';
import {
  CalloutSkeleton,
  LessonPathSkeleton,
  ProgressSkeleton,
} from '@/components/HomeSkeletons';
import { ProgressSummary } from '@/components/ProgressSummary';
import { ReviewCallout, ReviewEmptyState } from '@/components/ReviewCallout';
import { UnitChapter } from '@/components/UnitChapter';
import { groupByUnit, nextLesson, withLockState, type UnitGroup } from '@/lib/lessons';
import { useTheme } from '@/theme';

export default function Home() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  /**
   * Which chapters the learner has opened by hand.
   *
   * The current chapter is expanded by default and the rest are collapsed, but a
   * tap overrides that either way — hence a set of explicit overrides rather than
   * a set of "expanded" ids, so the default can stay derived from progress as it
   * moves. Local UI state on purpose: it should reset when the screen does.
   */
  const [toggled, setToggled] = useState<Set<string>>(new Set());

  function toggleUnit(unit: string) {
    setToggled((current) => {
      const next = new Set(current);
      if (next.has(unit)) next.delete(unit);
      else next.add(unit);
      return next;
    });
  }

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
    queryKey: ['lessons'],
    // Every unit in one request. Lock state is derived from the whole set, so
    // a katakana lesson can name the hiragana lesson that opens it.
    queryFn: () => fetchLessons(),
    // Lesson content is seeded and effectively static; only its lock state
    // moves, and that comes from the progress query above.
    staleTime: 5 * 60_000,
  });

  const refreshing = progress.isRefetching || lessons.isRefetching;

  function refetchAll() {
    void progress.refetch();
    void lessons.refetch();
  }

  const units: UnitGroup[] =
    progress.data && lessons.data
      ? groupByUnit(withLockState(lessons.data, progress.data.completedLessonIds))
      : [];

  const next = nextLesson(units);
  const nextUnitLabel = units.find((unit) => unit.unit === next?.unit)?.label ?? '';
  const nothingDoneYet = (progress.data?.lessonsCompleted ?? 0) === 0;

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

          <ChatCallout onPress={() => router.push('/chat')} />
        </>
      )}

      {lessons.isPending ? (
        <LessonPathSkeleton />
      ) : lessons.isError ? (
        <View style={{ paddingTop: theme.spacing.md }}>
          <ErrorState error={lessons.error} onRetry={refetchAll} />
        </View>
      ) : units.length === 0 ? (
        <EmptyLessons />
      ) : (
        <>
          {next ? (
            <ContinueCard
              lesson={next}
              unitLabel={nextUnitLabel}
              fresh={nothingDoneYet}
              onPress={(lesson) => router.push(`/lesson/${lesson.id}`)}
            />
          ) : (
            <CourseComplete />
          )}

          {units.map((unit) => (
            <UnitChapter
              key={unit.unit}
              group={unit}
              nextLessonId={next?.id}
              // The current chapter is open by default — it is the only one whose
              // path the learner needs — and a tap flips whichever chapter it hits.
              expanded={
                toggled.has(unit.unit) ? unit.status !== 'current' : unit.status === 'current'
              }
              onToggle={toggleUnit}
              onPressLesson={(lesson) => router.push(`/lesson/${lesson.id}`)}
            />
          ))}
        </>
      )}
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
