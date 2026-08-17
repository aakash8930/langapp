import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchProgress } from '@/api/progress';
import { useAuth } from '@/components/AuthProvider';
import { ErrorState } from '@/components/ErrorState';
import { useTheme } from '@/theme';

export default function Profile() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();
  const progress = useQuery({ queryKey: ['progress'], queryFn: fetchProgress });

  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing.xl, paddingTop: insets.top + theme.spacing.xl, paddingBottom: insets.bottom + 88, gap: theme.spacing.xxl }}>
      <View style={{ gap: theme.spacing.xs }}><Text style={{ fontFamily: theme.families.ui, fontSize: theme.fontSize.heading, color: theme.colors.ink }}>{user?.profile.displayName ?? 'Profile'}</Text><Text style={{ fontFamily: theme.families.ui, fontSize: theme.fontSize.small, color: theme.colors.inkSoft }}>{user?.email}</Text></View>

      {progress.isError ? <ErrorState error={progress.error} onRetry={() => void progress.refetch()} /> : progress.data ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
            <Stat label="Level" value={String(progress.data.level)} />
            <Stat label="XP" value={progress.data.xp.toLocaleString()} />
            <Stat label="Streak" value={`${progress.data.streakDays} days`} />
            <Stat label="Lessons" value={String(progress.data.lessonsCompleted)} />
          </View>
          <View style={{ padding: theme.spacing.xl, borderWidth: theme.hairlineWidth, borderColor: theme.colors.hairline, borderRadius: theme.radius.lg, gap: theme.spacing.sm }}><Text style={{ fontFamily: theme.families.ui, color: theme.colors.ink, fontSize: theme.fontSize.bodyLarge }}>Course progress</Text><Text style={{ fontFamily: theme.families.ui, color: theme.colors.inkSoft }}>{progress.data.passedUnits?.length ?? 0} unit checkpoints passed</Text></View>
        </>
      ) : null}

      <View style={{ gap: 0 }}>
        <Row title="Settings and reminders" onPress={() => router.push('/settings')} />
        <Row title="Friends and messages" onPress={() => router.push('/friends')} />
        <Row title="Leaderboard" onPress={() => router.push('/leaderboard')} />
        <Row title="Sign out" danger onPress={() => void logout()} />
      </View>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return <View style={{ width: '47%', padding: theme.spacing.lg, borderWidth: theme.hairlineWidth, borderColor: theme.colors.hairline, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface, gap: 2 }}><Text style={{ fontFamily: theme.families.ui, color: theme.colors.inkSoft, fontSize: theme.fontSize.caption }}>{label}</Text><Text style={[{ fontFamily: theme.families.ui, color: theme.colors.ink, fontSize: theme.fontSize.title }, theme.tabularFigures]}>{value}</Text></View>;
}

function Row({ title, onPress, danger = false }: { title: string; onPress: () => void; danger?: boolean }) {
  const theme = useTheme();
  return <Pressable onPress={onPress} style={({ pressed }) => ({ minHeight: theme.controlHeight, paddingVertical: theme.spacing.lg, borderBottomWidth: theme.hairlineWidth, borderBottomColor: theme.colors.hairline, flexDirection: 'row', alignItems: 'center', opacity: pressed ? .6 : 1 })}><Text style={{ flex: 1, fontFamily: theme.families.ui, color: danger ? theme.colors.danger : theme.colors.ink, fontSize: theme.fontSize.body }}>{title}</Text><Text style={{ color: theme.colors.inkSoft, fontSize: 20 }}>›</Text></Pressable>;
}
