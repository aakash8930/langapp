import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/theme';

/**
 * Sits above the lesson list whenever cards are due, and is the only solid
 * vermilion surface in the app outside the grade scale.
 *
 * That weight is the point: SRS only works if due cards get cleared before new
 * material is added, so this has to out-shout a list of tempting new lessons.
 */
export function ReviewCallout({ count, onPress }: { count: number; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Review ${count} ${count === 1 ? 'card' : 'cards'}`}
      style={({ pressed }) => ({
        backgroundColor: theme.colors.shu,
        borderRadius: theme.radius.lg,
        padding: theme.spacing.xl,
        gap: theme.spacing.xs,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text
        style={{
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.title,
          color: theme.colors.paper,
        }}
      >
        Review {count} {count === 1 ? 'card' : 'cards'}
      </Text>
      <Text
        style={{
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.small,
          lineHeight: theme.lineHeight.small,
          // Full strength, not dimmed: `paper` at 0.85 on `shu` composites to
          // 3.9:1, under AA. The size step from 22 to 14 already does the work
          // the opacity was doing.
          color: theme.colors.paper,
        }}
      >
        Due now. Clear these before starting something new.
      </Text>
    </Pressable>
  );
}

/**
 * The no-cards-due state. Never a shrug — it either points at the next lesson
 * or explains why the queue is empty and what fills it.
 */
export function ReviewEmptyState({ hasStarted }: { hasStarted: boolean }) {
  const theme = useTheme();

  return (
    <View
      style={{
        borderWidth: theme.hairlineWidth,
        borderColor: theme.colors.hairline,
        borderRadius: theme.radius.lg,
        padding: theme.spacing.xl,
        gap: theme.spacing.xs,
      }}
    >
      <Text
        style={{
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.bodyLarge,
          color: theme.colors.ink,
        }}
      >
        {hasStarted ? 'Nothing due right now' : 'Start with your first lesson'}
      </Text>
      <Text
        style={{
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.small,
          lineHeight: theme.lineHeight.small,
          color: theme.colors.inkSoft,
        }}
      >
        {hasStarted
          ? 'Your queue is clear. Pick up a new lesson below, or come back when cards come due.'
          : 'Finishing a lesson turns its characters into review cards, and those cards are what make them stick.'}
      </Text>
    </View>
  );
}
