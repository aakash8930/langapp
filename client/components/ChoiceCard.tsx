import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/theme';

/**
 * One selectable card — a full-width row with a title, an optional
 * description, and a leading indicator. `variant="radio"` for
 * pick-exactly-one lists (a filled ring), `variant="checkbox"` for
 * pick-any lists (a check mark), with the same visual weight either way so
 * settings and first-run choices remain one coherent control family.
 *
 * Selected state is an ink border and a filled indicator — no vermilion.
 * `shu` is reserved for active learning state and the grade scale (see
 * `SegmentedControl`'s comment); a settings-shaped choice is not that.
 */
export function ChoiceCard({
  title,
  description,
  selected,
  onPress,
  variant = 'radio',
}: {
  title: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  variant?: 'radio' | 'checkbox';
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={variant === 'radio' ? 'radio' : 'checkbox'}
      accessibilityLabel={title}
      accessibilityState={variant === 'radio' ? { selected } : { checked: selected }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: description ? 'flex-start' : 'center',
        gap: theme.spacing.md,
        minHeight: theme.controlHeight,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.md,
        borderRadius: theme.radius.md,
        borderWidth: selected ? 1 : theme.hairlineWidth,
        borderColor: selected ? theme.colors.ink : theme.colors.hairline,
        backgroundColor: theme.colors.surface,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 20,
          height: 20,
          marginTop: description ? 2 : 0,
          borderRadius: variant === 'radio' ? theme.radius.pill : theme.radius.sm,
          borderWidth: theme.hairlineWidth,
          borderColor: selected ? theme.colors.ink : theme.colors.hairline,
          backgroundColor: selected ? theme.colors.ink : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected && variant === 'checkbox' ? (
          <Text style={{ fontSize: 12, color: theme.colors.paper, lineHeight: 14 }}>{'✓'}</Text>
        ) : null}
      </View>

      <View style={{ flex: 1, gap: theme.spacing.xs }}>
        <Text
          style={{
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.body,
            color: theme.colors.ink,
          }}
        >
          {title}
        </Text>
        {description ? (
          <Text
            style={{
              fontFamily: theme.families.ui,
              fontSize: theme.fontSize.small,
              lineHeight: theme.lineHeight.small,
              color: theme.colors.inkSoft,
            }}
          >
            {description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
