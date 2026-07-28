import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/theme';

export type Segment<T> = {
  value: T;
  label: string;
};

/**
 * A connected row of mutually exclusive choices.
 *
 * Shares the grade scale's "one object, several regions" construction, but
 * deliberately none of its colour: the selected segment is a plain ink fill.
 * Vermilion belongs to the grade scale and to active learning state, and
 * spending it on a settings toggle would cheapen both.
 */
export function SegmentedControl<T extends string | number | boolean>({
  options,
  value,
  onChange,
  label,
  disabled,
}: {
  options: readonly Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Names the group for screen readers, e.g. "Theme". */
  label: string;
  disabled?: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        borderRadius: theme.radius.md,
        borderWidth: theme.hairlineWidth,
        borderColor: theme.colors.hairline,
        overflow: 'hidden',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <Pressable
            key={String(option.value)}
            onPress={() => onChange(option.value)}
            disabled={disabled || selected}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected, disabled }}
            style={({ pressed }) => ({
              flex: 1,
              // Full control height: these are small labels, and a cramped row
              // of them is the classic settings-screen mis-tap.
              height: theme.controlHeight,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: theme.spacing.sm,
              backgroundColor: selected ? theme.colors.ink : 'transparent',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              numberOfLines={1}
              style={{
                fontFamily: theme.families.ui,
                fontSize: theme.fontSize.small,
                color: selected ? theme.colors.paper : theme.colors.ink,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
