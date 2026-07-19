import { View, Text, StyleSheet } from 'react-native';

import type { Progress } from '@/api/progress';
import { useTheme } from '@/theme';

/**
 * The streak carries this screen. It is set at display size in vermilion and
 * everything else — XP, goal — is deliberately quieter, because the streak is
 * the number that brings someone back tomorrow.
 */
export function ProgressSummary({ progress }: { progress: Progress }) {
  const theme = useTheme();
  const { streakDays, daily } = progress;

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.md }}>
        <Text
          style={[
            {
              fontFamily: theme.families.ui,
              fontSize: theme.fontSize.displayNumber,
              // The glyph box is taller than the digits; without this the
              // baseline floats away from the label sitting beside it.
              lineHeight: theme.fontSize.displayNumber,
              color: theme.colors.shu,
            },
            theme.tabularFigures,
          ]}
          allowFontScaling={false}
        >
          {streakDays}
        </Text>
        <Text
          style={{
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.body,
            color: theme.colors.inkSoft,
            paddingBottom: theme.spacing.sm,
          }}
        >
          day streak
        </Text>
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <GoalBar percent={daily.percentOfGoal} met={daily.goalMet} />
        <Text
          style={[
            {
              fontFamily: theme.families.ui,
              fontSize: theme.fontSize.small,
              color: theme.colors.inkSoft,
            },
            theme.tabularFigures,
          ]}
        >
          {daily.goalMet
            ? `Daily goal met — ${daily.xpToday} XP today`
            : `${daily.xpToday} of ${daily.goalXp} XP today`}
        </Text>
      </View>
    </View>
  );
}

function GoalBar({ percent, met }: { percent: number; met: boolean }) {
  const theme = useTheme();

  return (
    <View
      // The bar is decoration; the sentence under it carries the same number.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.track,
        {
          height: theme.spacing.xs,
          backgroundColor: theme.colors.hairline,
          borderRadius: theme.radius.pill,
        },
      ]}
    >
      <View
        style={{
          width: `${percent}%`,
          height: '100%',
          borderRadius: theme.radius.pill,
          // Indigo once the goal is met, so hitting it reads as a state change
          // rather than just a longer bar.
          backgroundColor: met ? theme.colors.ai : theme.colors.shu,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    overflow: 'hidden',
  },
});
