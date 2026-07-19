import { Text, View } from 'react-native';

import { useTheme } from '@/theme';

/**
 * Position through a bounded session, over a thin vermilion rule.
 *
 * Shared by the lesson and review screens because they are the same idea — a
 * finite queue you are partway through — and the bar should be recognisably
 * the same object in both. Only the caption differs: a lesson counts up to its
 * length, a review session counts down what is left.
 */
export function SessionProgress({
  position,
  total,
  caption,
}: {
  /** 1-based index of the item on screen. */
  position: number;
  total: number;
  /** Visible text. The bar itself is described to screen readers separately. */
  caption: string;
}) {
  const theme = useTheme();
  const filled = total > 0 ? (position / total) * 100 : 0;

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
