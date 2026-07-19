import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '@/theme';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  disabled?: boolean;
};

/**
 * Primary is a solid ink fill; secondary is indigo text on a hairline. Neither
 * uses vermilion — `shu` is reserved for active state and the grade scale, and
 * spending it on an ordinary submit button would flatten that distinction.
 */
export function Button({ label, onPress, variant = 'primary', loading, disabled }: Props) {
  const theme = useTheme();
  const isPrimary = variant === 'primary';
  const inactive = disabled || loading;

  const background = isPrimary ? theme.colors.ink : 'transparent';
  const foreground = isPrimary ? theme.colors.paper : theme.colors.ai;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      // Stated explicitly rather than inferred from the child <Text>, which is
      // swapped out for a spinner while loading — leaving the control nameless
      // at exactly the moment someone might ask what it is doing.
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        {
          height: theme.controlHeight,
          backgroundColor: background,
          borderColor: isPrimary ? 'transparent' : theme.colors.hairline,
          borderWidth: isPrimary ? 0 : theme.hairlineWidth,
          borderRadius: theme.radius.md,
          paddingHorizontal: theme.spacing.xl,
          // No scale transform, no shadow lift — press is a flat opacity step.
          opacity: inactive ? 0.5 : pressed ? 0.7 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <Text
          style={{
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.body,
            color: foreground,
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
