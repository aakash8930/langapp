import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchLessons } from '@/api/lessons';
import { fetchProgress } from '@/api/progress';
import { ContinueCard, CourseComplete } from '@/components/ContinueCard';
import { ErrorState } from '@/components/ErrorState';
import { LessonPathSkeleton } from '@/components/HomeSkeletons';
import { UnitChapter } from '@/components/UnitChapter';
import { groupByUnit, nextLesson, withLockState } from '@/lib/lessons';
import { useTheme } from '@/theme';

function routeFor(lesson: { id: string; completed: boolean }): string {
  return lesson.completed ? `/lesson/${lesson.id}` : `/study/${lesson.id}`;
}

export default function Learn() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [toggled, setToggled] = useState<Set<string>>(new Set());
  const progress = useQuery({ queryKey: ['progress'], queryFn: fetchProgress, staleTime: 0 });
  const lessons = useQuery({ queryKey: ['lessons'], queryFn: () => fetchLessons(), staleTime: 5 * 60_000 });

  const units = progress.data && lessons.data
    ? groupByUnit(withLockState(lessons.data, progress.data.completedLessonIds))
    : [];
  const next = nextLesson(units);
  const nextUnitLabel = units.find((unit) => unit.unit === next?.unit)?.label ?? '';

  const retry = () => { void progress.refetch(); void lessons.refetch(); };
  const toggle = (unit: string) => setToggled((current) => {
    const copy = new Set(current);
    if (copy.has(unit)) copy.delete(unit);
    else copy.add(unit);
    return copy;
  });

  return (
    <ScrollView
      contentContainerStyle={{ padding: theme.spacing.xl, paddingTop: insets.top + theme.spacing.lg, paddingBottom: insets.bottom + 88, gap: theme.spacing.xxl }}
      refreshControl={<RefreshControl refreshing={progress.isRefetching || lessons.isRefetching} onRefresh={retry} tintColor={theme.colors.inkSoft} />}
    >
      <View style={{ gap: theme.spacing.xs }}>
        <Text style={{ fontFamily: theme.families.ui, fontSize: theme.fontSize.heading, color: theme.colors.ink }}>Learn Japanese</Text>
        <Text style={{ fontFamily: theme.families.ui, fontSize: theme.fontSize.body, lineHeight: theme.lineHeight.body, color: theme.colors.inkSoft }}>One ordered path. Only your current chapter is expanded.</Text>
      </View>

      {progress.isError || lessons.isError ? <ErrorState error={progress.error ?? lessons.error} onRetry={retry} />
        : progress.isPending || lessons.isPending ? <LessonPathSkeleton />
        : units.length === 0 ? <Text style={{ color: theme.colors.inkSoft }}>No lessons are loaded.</Text>
        : <>
            {next ? <ContinueCard lesson={next} unitLabel={nextUnitLabel} fresh={progress.data.lessonsCompleted === 0} onPress={(lesson) => router.push(routeFor(lesson))} /> : <CourseComplete />}
            {units.map((unit) => (
              <UnitChapter
                key={unit.unit}
                group={unit}
                nextLessonId={next?.id}
                expanded={toggled.has(unit.unit) ? unit.status !== 'current' : unit.status === 'current'}
                onToggle={toggle}
                onPressLesson={(lesson) => router.push(routeFor(lesson))}
                onPressCheckpoint={() => router.push(`/checkpoint/${unit.unit}`)}
              />
            ))}
          </>}
    </ScrollView>
  );
}
