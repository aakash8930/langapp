import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchLessons } from '@/api/lessons';
import { fetchUnreadCount } from '@/api/notifications';
import { fetchProgress } from '@/api/progress';
import { useAuth } from '@/components/AuthProvider';
import { ContinueCard, CourseComplete } from '@/components/ContinueCard';
import { ErrorState } from '@/components/ErrorState';
import { ProgressSkeleton } from '@/components/HomeSkeletons';
import { NotificationsLink } from '@/components/NotificationsLink';
import { groupByUnit, nextLesson, withLockState } from '@/lib/lessons';
import { useTheme } from '@/theme';

function routeFor(lesson: { id: string; completed: boolean }): string {
  return lesson.completed ? `/lesson/${lesson.id}` : `/study/${lesson.id}`;
}

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Today() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const progress = useQuery({ queryKey: ['progress'], queryFn: fetchProgress, staleTime: 0, refetchOnMount: 'always' });
  const lessons = useQuery({ queryKey: ['lessons'], queryFn: () => fetchLessons(), staleTime: 5 * 60_000 });
  const unread = useQuery({ queryKey: ['notificationsUnread'], queryFn: fetchUnreadCount, staleTime: 30_000 });
  const units = progress.data && lessons.data ? groupByUnit(withLockState(lessons.data, progress.data.completedLessonIds)) : [];
  const next = nextLesson(units);
  const nextUnit = units.find((unit) => unit.unit === next?.unit);
  const retry = () => { void progress.refetch(); void lessons.refetch(); };

  return (
    <ScrollView
      contentContainerStyle={{ padding: theme.spacing.xl, paddingTop: insets.top + theme.spacing.lg, paddingBottom: insets.bottom + 88, gap: theme.spacing.xxl }}
      refreshControl={<RefreshControl refreshing={progress.isRefetching || lessons.isRefetching} onRefresh={retry} tintColor={theme.colors.inkSoft} />}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: theme.families.ui, fontSize: theme.fontSize.small, color: theme.colors.inkSoft }}>{greeting()}</Text>
          <Text numberOfLines={1} style={{ fontFamily: theme.families.ui, fontSize: theme.fontSize.title, color: theme.colors.ink }}>{user?.profile.displayName ?? 'Learner'}</Text>
        </View>
        <NotificationsLink unreadCount={unread.data?.count ?? 0} onPress={() => router.push('/notifications')} />
      </View>

      {progress.isError || lessons.isError ? <ErrorState error={progress.error ?? lessons.error} onRetry={retry} />
        : progress.isPending || lessons.isPending ? <ProgressSkeleton />
        : <>
            <View style={{ gap: theme.spacing.sm }}>
              <Text style={{ fontFamily: theme.families.ui, fontSize: theme.fontSize.caption, color: theme.colors.inkSoft, letterSpacing: 1, textTransform: 'uppercase' }}>Continue learning</Text>
              {next ? <ContinueCard lesson={next} unitLabel={nextUnit?.label ?? next.unit} fresh={progress.data.lessonsCompleted === 0} onPress={(lesson) => router.push(routeFor(lesson))} /> : <CourseComplete />}
            </View>

            <View style={{ padding: theme.spacing.xl, borderWidth: theme.hairlineWidth, borderColor: theme.colors.hairline, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface, gap: theme.spacing.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ fontFamily: theme.families.ui, color: theme.colors.ink, fontSize: theme.fontSize.bodyLarge }}>Today</Text><Text style={[{ fontFamily: theme.families.ui, color: theme.colors.ink }, theme.tabularFigures]}>{progress.data.daily.xpToday} / {progress.data.daily.goalXp} XP</Text></View>
              <View style={{ height: 5, borderRadius: theme.radius.pill, backgroundColor: theme.colors.hairline, overflow: 'hidden' }}><View style={{ width: `${progress.data.daily.percentOfGoal}%`, height: '100%', backgroundColor: theme.colors.shu }} /></View>
              <Text style={{ fontFamily: theme.families.ui, color: theme.colors.inkSoft, fontSize: theme.fontSize.small }}>{progress.data.daily.lessonsDone} lesson{progress.data.daily.lessonsDone === 1 ? '' : 's'} completed · {progress.data.streakDays} day streak</Text>
            </View>

            <View style={{ gap: theme.spacing.sm }}>
              <SecondaryAction title="Quick practice" detail="Five questions from completed lessons" onPress={() => router.push('/practice')} />
              <SecondaryAction title="Ask the tutor" detail="Get help with Japanese or practise a conversation" onPress={() => router.push('/chat')} />
            </View>
          </>}
    </ScrollView>
  );
}

function SecondaryAction({ title, detail, onPress }: { title: string; detail: string; onPress: () => void }) {
  const theme = useTheme();
  return <Pressable onPress={onPress} style={({ pressed }) => ({ paddingVertical: theme.spacing.lg, borderBottomWidth: theme.hairlineWidth, borderBottomColor: theme.colors.hairline, opacity: pressed ? .6 : 1, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md })}><View style={{ flex: 1, gap: 2 }}><Text style={{ fontFamily: theme.families.ui, fontSize: theme.fontSize.body, color: theme.colors.ink }}>{title}</Text><Text style={{ fontFamily: theme.families.ui, fontSize: theme.fontSize.small, color: theme.colors.inkSoft }}>{detail}</Text></View><Text style={{ color: theme.colors.shu, fontSize: 20 }}>›</Text></Pressable>;
}
