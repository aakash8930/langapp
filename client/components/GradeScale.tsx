import { Pressable, Text, View } from 'react-native';

import { REVIEW_GRADES, type ReviewGrade } from '@/api/reviews';
import { useTheme } from '@/theme';

const LABELS: Record<ReviewGrade, string> = {
  again: 'Again',
  hard: 'Hard',
  good: 'Good',
  easy: 'Easy',
};

/**
 * The four FSRS grades as one connected control, not four buttons.
 *
 * The segments share edges and the whole strip carries a single radius, so it
 * reads as one object with four regions — a scale you pick a point on, rather
 * than four things you choose between. Weight comes from `theme.colors.
 * gradeScale`, which runs `again` heavy to `easy` pale: how hard the card was,
 * rendered as ink density instead of four unrelated hues.
 *
 * This is the screen's one bold gesture, and the reason the rest of the app
 * leaves `shu` alone.
 */
export function GradeScale({
  onGrade,
  disabled,
}: {
  onGrade: (grade: ReviewGrade) => void;
  /** Before the answer is revealed. Stays in place, so nothing shifts on reveal. */
  disabled?: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="radiogroup"
      style={{
        flexDirection: 'row',
        borderRadius: theme.radius.md,
        // Clips the segment fills to the strip's corners — the segments
        // themselves are square, which is what keeps the joins invisible.
        overflow: 'hidden',
        opacity: disabled ? 0.35 : 1,
      }}
    >
      {REVIEW_GRADES.map((grade) => {
        const step = theme.colors.gradeScale[grade];

        return (
          <Pressable
            key={grade}
            onPress={() => onGrade(grade)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={LABELS[grade]}
            accessibilityState={{ disabled }}
            style={({ pressed }) => ({
              flex: 1,
              // Taller than an ordinary control: this one gets pressed twenty
              // times in a row, half-awake, and a miss costs a wrong interval.
              height: theme.controlHeight + theme.spacing.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: step.bg,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              style={{
                fontFamily: theme.families.ui,
                fontSize: theme.fontSize.body,
                color: step.fg,
              }}
            >
              {LABELS[grade]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
