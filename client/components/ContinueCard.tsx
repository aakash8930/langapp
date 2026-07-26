import { Pressable, Text, View } from 'react-native';

import type { LessonWithState } from '@/lib/lessons';
import { useTheme } from '@/theme';

/**
 * The one thing this screen asks you to do.
 *
 * The old home screen opened with a streak number and then a list, which meant
 * the answer to "what now?" was somewhere in 58 rows. This puts it at the top,
 * says which chapter it belongs to, and is the largest tap target on the page.
 *
 * Solid vermilion because it is the only primary action here — every other
 * pressable on the screen is a hollow node or a heading, so there is no
 * competition for the eye. Contrast: `paper` on `shu` is the pairing the palette
 * already documents as AA-clear (the token was darkened to #BC3E28 for exactly
 * this), so the large title and the small label both pass.
 */
export function ContinueCard({
  lesson,
  unitLabel,
  fresh,
  onPress,
}: {
  lesson: LessonWithState;
  unitLabel: string;
  /** True when nothing has been completed yet, which changes the verb. */
  fresh: boolean;
  onPress: (lesson: LessonWithState) => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => onPress(lesson)}
      accessibilityRole="button"
      accessibilityLabel={`${fresh ? 'Start' : 'Continue'}: ${lesson.title}, in ${unitLabel}. ${
        lesson.itemCount
      } items.`}
      style={({ pressed }) => ({
        gap: theme.spacing.sm,
        padding: theme.spacing.xl,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.shu,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text
        style={{
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.caption,
          color: theme.colors.paper,
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}
      >
        {fresh ? 'Start here' : 'Continue'} · {unitLabel}
      </Text>

      <Text
        style={{
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.title,
          lineHeight: theme.lineHeight.title,
          color: theme.colors.paper,
        }}
      >
        {lesson.title}
      </Text>

      <Text
        style={[
          {
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.small,
            color: theme.colors.paper,
          },
          theme.tabularFigures,
        ]}
      >
        {lesson.itemCount} to learn
      </Text>
    </Pressable>
  );
}

/**
 * Shown instead of the card when every lesson is complete.
 *
 * Reachable now — 58 lessons is a lot, but it is finite, and a learner who
 * finishes deserves better than the card silently vanishing. Points at reviews,
 * because that is genuinely what is left to do.
 */
export function CourseComplete() {
  const theme = useTheme();

  return (
    <View
      style={{
        gap: theme.spacing.sm,
        padding: theme.spacing.xl,
        borderRadius: theme.radius.lg,
        borderWidth: theme.hairlineWidth,
        borderColor: theme.colors.hairline,
        backgroundColor: theme.colors.surface,
      }}
    >
      <Text
        style={{
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.title,
          lineHeight: theme.lineHeight.title,
          color: theme.colors.ink,
        }}
      >
        Every lesson done
      </Text>
      <Text
        style={{
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.body,
          lineHeight: theme.lineHeight.body,
          color: theme.colors.inkSoft,
        }}
      >
        Keep your reviews up to date — that is where the words actually stick.
      </Text>
    </View>
  );
}
