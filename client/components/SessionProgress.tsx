import { Text, View } from 'react-native';

import { useTheme } from '@/theme';

/**
 * Position through a bounded session, over a thin vermilion rule.
 *
 * Used by bounded lesson and checkpoint sessions: a
 * finite queue you are partway through — and the bar should be recognisably
 * the same object in both. Only the caption differs: a lesson counts up to its
 * length, a checkpoint counts down what is left.
 */
export function SessionProgress({
  position,
  total,
  caption,
  outcomes,
}: {
  /** 1-based index of the item on screen. */
  position: number;
  total: number;
  /** Visible text. The bar itself is described to screen readers separately. */
  caption: string;
  /**
   * Per-question results, when the caller has them — `true` right, `false`
   * wrong, `undefined` not reached. Given, the bar becomes one pip per
   * question; omitted, it stays a plain fill.
   *
   * The distinction is not decorative. A continuous bar answers "how far
   * through am I", which is the only useful question in a bounded session, where
   * every card is graded and none of them can fail the session. A lesson is now
   * pass-or-repeat, so "is this run still clean" matters more — and that needs
   * per-question state a single bar cannot carry. Same reasoning, and same
   * look, as the website.
   */
  outcomes?: (boolean | undefined)[];
}) {
  const theme = useTheme();
  const filled = total > 0 ? (position / total) * 100 : 0;

  if (outcomes) {
    return (
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={`${position} of ${total}`}
        style={{ gap: theme.spacing.sm }}
      >
        <Text
          style={{
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.caption,
            color: theme.colors.inkSoft,
            letterSpacing: 1,
            ...theme.tabularFigures,
          }}
        >
          {caption}
        </Text>

        <View style={{ flexDirection: 'row', gap: 3 }}>
          {Array.from({ length: total }, (_, index) => (
            <View
              key={index}
              style={{
                flex: 1,
                height: theme.spacing.xs,
                borderRadius: theme.radius.pill,
                backgroundColor:
                  outcomes[index] === true
                    ? theme.colors.shu
                    : outcomes[index] === false
                      ? theme.colors.danger
                      : index === position
                        ? theme.colors.inkSoft
                        : theme.colors.hairline,
              }}
            />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`${position} of ${total}`}
      style={{ gap: theme.spacing.sm }}
    >
      <Text
        style={{
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.caption,
          color: theme.colors.inkSoft,
          letterSpacing: 1,
          ...theme.tabularFigures,
        }}
      >
        {caption}
      </Text>

      <View
        style={{
          height: theme.spacing.xs,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.hairline,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${filled}%`,
            height: '100%',
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.shu,
          }}
        />
      </View>
    </View>
  );
}
