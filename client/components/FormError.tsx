import { Text, View } from 'react-native';

import { useTheme } from '@/theme';

/**
 * A whole-form error — the request failed, as opposed to one field being
 * malformed. Marked as an alert so a screen reader announces it without the
 * user having to hunt for what changed after pressing the button.
 */
export function FormError({ message }: { message: string }) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={{
        borderLeftWidth: 2,
        borderLeftColor: theme.colors.danger,
        paddingLeft: theme.spacing.md,
        paddingVertical: theme.spacing.xs,
      }}
    >
      <Text
        style={{
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.small,
          lineHeight: theme.lineHeight.small,
          color: theme.colors.danger,
        }}
      >
        {message}
      </Text>
    </View>
  );
}
