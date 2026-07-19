import { Pressable, Text, View } from 'react-native';

import type { LessonWithState } from '@/lib/lessons';
import { useTheme } from '@/theme';

/**
 * One lesson. Locked rows stay legible rather than being greyed into noise —
 * seeing what is coming is part of what makes the unit feel finite — but they
 * do not respond to touch, and they say what opens them.
 */
export function LessonRow({
  lesson,
  onPress,
}: {
  lesson: LessonWithState;
  onPress: (lesson: LessonWithState) => void;
}) {
  const theme = useTheme();
  const { locked, completed, title, itemCount, lockedBy } = lesson;

  const subtitle = locked
    ? lockedBy
      ? `Complete “${lockedBy}” first`
      : 'Complete the earlier lessons first'
    : completed
      ? `Done · ${itemCount} characters`
      : `${itemCount} characters`;

  return (
    <Pressable
      onPress={() => onPress(lesson)}
      disabled={locked}
      accessibilityRole="button"
      accessibilityState={{ disabled: locked }}
      accessibilityLabel={`${title}. ${subtitle}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.lg,
        paddingVertical: theme.spacing.lg,
        borderBottomWidth: theme.hairlineWidth,
        borderBottomColor: theme.colors.hairline,
        opacity: pressed && !locked ? 0.6 : 1,
      })}
    >
      <Marker completed={completed} locked={locked} />

      <View style={{ flex: 1, gap: theme.spacing.xs }}>
        <Text
          style={{
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.body,
            lineHeight: theme.lineHeight.body,
            color: locked ? theme.colors.inkSoft : theme.colors.ink,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.small,
            color: theme.colors.inkSoft,
          }}
        >
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * A small genkouyoushi-ish square standing in for the lesson's state: filled
 * vermilion when done, hairline when open, empty when locked.
 */
function Marker({ completed, locked }: { completed: boolean; locked: boolean }) {
  const theme = useTheme();

  return (
    <View
      style={{
        width: theme.spacing.lg,
        height: theme.spacing.lg,
        borderRadius: theme.radius.sm,
        backgroundColor: completed ? theme.colors.shu : 'transparent',
        borderWidth: completed ? 0 : theme.hairlineWidth,
        borderColor: locked ? theme.colors.hairline : theme.colors.shu,
      }}
    />
  );
}
