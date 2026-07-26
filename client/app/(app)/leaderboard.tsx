import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchLeaderboard, type Leaderboard, type LeaderboardRow } from '@/api/social';
import { Button } from '@/components/Button';
import { ErrorState } from '@/components/ErrorState';
import { useTheme } from '@/theme';

/**
 * This week's league table.
 *
 * The week runs on a **UTC** clock rather than the learner's local one — a
 * ranking that compares people needs a shared boundary, unlike the streak and
 * daily goal. The countdown is rendered from `endsAt`, which the server sends as
 * an instant precisely so both sides agree on the deadline.
 */
export default function LeaderboardScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const board = useQuery({
    queryKey: ['leaderboard'],
    queryFn: fetchLeaderboard,
    // The table moves whenever anyone studies, and this read is also what
    // settles a closed week — so it always re-asks on arrival.
    staleTime: 0,
    refetchOnMount: 'always',
  });

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        padding: theme.spacing.xl,
        paddingTop: insets.top + theme.spacing.xl,
        paddingBottom: insets.bottom + theme.spacing.xl,
        gap: theme.spacing.xl,
      }}
      refreshControl={
        <RefreshControl
          refreshing={board.isRefetching}
          onRefresh={() => void board.refetch()}
          tintColor={theme.colors.inkSoft}
        />
      }
    >
      {board.isPending ? (
        <Text style={muted(theme)}>Loading…</Text>
      ) : board.isError ? (
        <ErrorState error={board.error} onRetry={() => void board.refetch()} />
      ) : (
        <>
          <Header board={board.data} />
          <Table rows={board.data.rows} board={board.data} />
        </>
      )}

      <Button label="Back to home" variant="secondary" onPress={() => router.back()} />
    </ScrollView>
  );
}

function Header({ board }: { board: Leaderboard }) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text
        style={{
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.heading,
          lineHeight: theme.lineHeight.heading,
          color: theme.colors.shu,
        }}
      >
        {board.tierName} league
      </Text>
      <Text style={[muted(theme), theme.tabularFigures]}>
        Tier {board.tier + 1} of {board.tierCount} · {daysLeft(board.endsAt)}
      </Text>
      <Text style={muted(theme)}>
        {board.promotionCount === 0
          ? 'Too few players this week for anyone to move up or down.'
          : `Top ${board.promotionCount} move up, bottom ${board.relegationCount} move down when the week closes.`}
      </Text>
    </View>
  );
}

function Table({ rows, board }: { rows: LeaderboardRow[]; board: Leaderboard }) {
  const theme = useTheme();

  if (rows.length === 0) {
    return <Text style={muted(theme)}>Nobody in this league yet.</Text>;
  }

  /**
   * The promotion and relegation cut-offs, drawn as hairlines between rows. A
   * league table without them tells you your rank but not whether it is good
   * enough, which is the only question a learner is actually asking.
   */
  const promoteBelow = board.promotionCount;
  const relegateAbove = board.relegationCount > 0 ? rows.length - board.relegationCount : -1;

  return (
    <View>
      {rows.map((row, index) => (
        <View key={row.userId}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.lg,
              paddingVertical: theme.spacing.md,
              paddingHorizontal: theme.spacing.md,
              borderRadius: theme.radius.md,
              // The learner's own row is tinted rather than bordered, so the
              // cut-off hairlines stay the only rules on the screen.
              backgroundColor: row.isYou ? theme.colors.surface : 'transparent',
            }}
          >
            <Text
              style={[
                {
                  minWidth: theme.spacing.xxl,
                  fontFamily: theme.families.ui,
                  fontSize: theme.fontSize.body,
                  color: row.isYou ? theme.colors.shu : theme.colors.inkSoft,
                },
                theme.tabularFigures,
              ]}
            >
              {row.rank}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                fontFamily: theme.families.ui,
                fontSize: theme.fontSize.body,
                color: theme.colors.ink,
              }}
            >
              {row.displayName}
              {row.isYou ? ' (you)' : ''}
            </Text>
            <Text
              style={[
                {
                  fontFamily: theme.families.ui,
                  fontSize: theme.fontSize.body,
                  color: theme.colors.inkSoft,
                },
                theme.tabularFigures,
              ]}
            >
              {row.weeklyXp} XP
            </Text>
          </View>

          {index + 1 === promoteBelow && index + 1 < rows.length ? (
            <CutOff label="Promotion" colour={theme.colors.shu} />
          ) : null}
          {index + 1 === relegateAbove && index + 1 < rows.length ? (
            <CutOff label="Relegation" colour={theme.colors.danger} />
          ) : null}
        </View>
      ))}
    </View>
  );
}

function CutOff({ label, colour }: { label: string; colour: string }) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.xs,
      }}
    >
      <View style={{ flex: 1, height: theme.hairlineWidth, backgroundColor: colour }} />
      <Text
        style={{
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.caption,
          color: colour,
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}
      >
        {label}
      </Text>
      <View style={{ flex: 1, height: theme.hairlineWidth, backgroundColor: colour }} />
    </View>
  );
}

/**
 * "3 days left" from the server's instant.
 *
 * Rendered to the nearest day rather than ticking, for the same reason the heart
 * countdown does not tick: a per-second timer would re-render the screen for a
 * number nobody reads that precisely.
 */
function daysLeft(endsAt: string): string {
  const remainingMs = new Date(endsAt).getTime() - Date.now();
  if (Number.isNaN(remainingMs) || remainingMs <= 0) return 'Closing now';

  const hours = Math.ceil(remainingMs / 3_600_000);
  if (hours <= 24) return hours === 1 ? '1 hour left' : `${hours} hours left`;

  const days = Math.ceil(hours / 24);
  return days === 1 ? '1 day left' : `${days} days left`;
}

function muted(theme: ReturnType<typeof useTheme>) {
  return {
    fontFamily: theme.families.ui,
    fontSize: theme.fontSize.body,
    lineHeight: theme.lineHeight.body,
    color: theme.colors.inkSoft,
  };
}
