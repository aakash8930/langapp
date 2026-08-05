import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/theme';

/**
 * The way in to the combined test.
 *
 * Border and title are in `shu` (vermilion) — the colour the per-unit
 * "Test yourself" node uses — so the home screen reads the combined
 * card as part of the same test family rather than a fresh surface
 * appearing out of nowhere. The hairline elsewhere on the home screen
 * is generic chrome; this needs the family colour to be noticed.
 *
 * The card is hidden by a 2-unit minimum, so on the day a learner
 * finishes their second unit it is the *first* time they see the
 * feature. The vermilion is what makes the appearance loud enough
 * to be picked up, and the unit list in the second line is what
 * explains what is being tested without making them tap to find out.
 */
export function CombinedTestCallout({
  finishedCount,
  unitLabels,
  onPress,
}: {
  finishedCount: number;
  unitLabels: string[];
  onPress: () => void;
}) {
  const theme = useTheme();

  // Cap the inline list at three names. A learner with eleven finished
  // units does not need to see all eleven — the summary on the test
  // screen lists them at submit. Showing "Hiragana basics · Katakana
  // basics · Vocab basics + 8 more" is the most a card can honestly
  // say without becoming a unit list of its own.
  const visible = unitLabels.slice(0, 3);
  const overflow = finishedCount - visible.length;
  const line =
    visible.length === 0
      ? `${finishedCount} units, 40 questions`
      : overflow > 0
        ? `${visible.join(' · ')} · +${overflow} more`
        : visible.join(' · ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Take the combined test across the ${finishedCount} units you have finished. 40 questions, one answer each.`}
      style={({ pressed }) => ({
        borderWidth: theme.hairlineWidth,
        borderColor: theme.colors.shu,
        borderRadius: theme.radius.lg,
        padding: theme.spacing.xl,
        gap: theme.spacing.xs,
        backgroundColor: theme.colors.surface,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: theme.spacing.md,
        }}
      >
        <Text
          style={{
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.bodyLarge,
            color: theme.colors.shu,
          }}
        >
          Test everything you’ve finished
        </Text>
        <Text
          style={{
            fontFamily: theme.families.ja,
            fontSize: theme.fontSize.small,
            color: theme.colors.inkSoft,
          }}
        >
          総合テスト
        </Text>
      </View>
      <Text
        style={{
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.small,
          lineHeight: theme.lineHeight.small,
          color: theme.colors.inkSoft,
        }}
      >
        {line} — 40 questions, one answer each.
      </Text>
    </Pressable>
  );
}