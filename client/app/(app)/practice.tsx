import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchLessons } from '@/api/lessons';
import { fetchProgress } from '@/api/progress';
import { ErrorState } from '@/components/ErrorState';
import { groupByUnit, withLockState } from '@/lib/lessons';
import { useTheme } from '@/theme';

export default function Practice() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const progress = useQuery({ queryKey: ['progress'], queryFn: fetchProgress });
  const lessons = useQuery({ queryKey: ['lessons'], queryFn: () => fetchLessons(), staleTime: 5 * 60_000 });
  const error = progress.error ?? lessons.error;
  const units = progress.data && lessons.data ? groupByUnit(withLockState(lessons.data, progress.data.completedLessonIds)) : [];
  const finished = units.filter((unit) => unit.status === 'done');
  const completedLessons = units.flatMap((unit) => unit.lessons).filter((lesson) => lesson.completed);
  const latestLesson = completedLessons.at(-1);
  const latestUnit = finished.at(-1);

  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing.xl, paddingTop: insets.top + theme.spacing.lg, paddingBottom: insets.bottom + 88, gap: theme.spacing.xxl }}>
      <View style={{ gap: theme.spacing.xs }}><Text style={{ fontFamily: theme.families.ui, fontSize: theme.fontSize.heading, color: theme.colors.ink }}>Practice</Text><Text style={{ fontFamily: theme.families.ui, fontSize: theme.fontSize.body, color: theme.colors.inkSoft, lineHeight: theme.lineHeight.body }}>Optional reinforcement from material you have already completed.</Text></View>
      {error ? <ErrorState error={error} onRetry={() => { void progress.refetch(); void lessons.refetch(); }} /> : <View style={{ gap: theme.spacing.md }}>
        <PracticeCard title="Quick practice" detail={latestLesson ? `Repeat ${latestLesson.title}` : 'Complete your first lesson to unlock practice'} meta="About 3–5 minutes" disabled={!latestLesson} primary onPress={() => latestLesson && router.push(`/lesson/${latestLesson.id}`)} />
        <PracticeCard title="Unit checkpoint" detail={latestUnit ? `Test ${latestUnit.label}` : 'Finish a unit to unlock its checkpoint'} meta="20 questions · one answer each" disabled={!latestUnit} onPress={() => latestUnit && router.push(`/checkpoint/${latestUnit.unit}`)} />
        <PracticeCard title="Combined test" detail={finished.length >= 2 ? `${finished.length} completed units available` : 'Finish two units to unlock mixed testing'} meta="Mixed completed content" disabled={finished.length < 2} onPress={() => router.push('/combined-test')} />
        <PracticeCard title="AI conversation" detail="Practise introductions and receive corrections" meta="Japanese, romaji, or English" onPress={() => router.push('/chat')} />
      </View>}
    </ScrollView>
  );
}

function PracticeCard({ title, detail, meta, disabled = false, primary = false, onPress }: { title: string; detail: string; meta: string; disabled?: boolean; primary?: boolean; onPress: () => void }) {
  const theme = useTheme();
  return <Pressable disabled={disabled} onPress={onPress} accessibilityRole="button" accessibilityState={{ disabled }} style={({ pressed }) => ({ padding: theme.spacing.xl, gap: theme.spacing.sm, borderRadius: theme.radius.lg, borderWidth: theme.hairlineWidth, borderColor: primary ? theme.colors.shu : theme.colors.hairline, backgroundColor: theme.colors.surface, opacity: disabled ? .5 : pressed ? .7 : 1 })}><Text style={{ fontFamily: theme.families.ui, fontSize: theme.fontSize.title, color: theme.colors.ink }}>{title}</Text><Text style={{ fontFamily: theme.families.ui, fontSize: theme.fontSize.body, color: theme.colors.inkSoft, lineHeight: theme.lineHeight.body }}>{detail}</Text><Text style={{ fontFamily: theme.families.ui, fontSize: theme.fontSize.caption, color: primary ? theme.colors.shu : theme.colors.inkSoft }}>{meta}</Text></Pressable>;
}
