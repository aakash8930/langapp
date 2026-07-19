import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/theme';

export type OptionState =
  /** Answerable. */
  | 'idle'
  /** Tapped; waiting on the server to say whether it was right. */
  | 'pending'
  /** Picked, and right. */
  | 'chosenRight'
  /** Picked, and wrong. */
  | 'chosenWrong'
  /** The right answer, surfaced after a wrong pick. */
  | 'answer'
  /** Neither picked nor correct — still legible, but out of the way. */
  | 'muted';

/**
 * One romaji choice.
 *
 * Both marked states are red, because the palette has no green and inventing
 * one for a single screen would break the identity. That is only safe because
 * colour is never the sole channel: ○ and × carry the same information, the
 * way a marked-up Japanese worksheet does. Anyone who cannot separate the two
 * reds reads the marks instead.
 */
export function OptionButton({
  label,
  state,
  onPress,
}: {
  label: string;
  state: OptionState;
  onPress: () => void;
}) {
  const theme = useTheme();

  // Filled only for a correct pick — the one moment worth spending the
  // reserved vermilion on.
  const filled = state === 'chosenRight';
  const wrong = state === 'chosenWrong';
  const revealed = state === 'answer';

  const border = filled
    ? 'transparent'
    : wrong
      ? theme.colors.danger
      : revealed
        ? theme.colors.shu
        : theme.colors.hairline;

  const foreground = filled
    ? theme.colors.paper
    : wrong
      ? theme.colors.danger
      : revealed
        ? theme.colors.shu
        : theme.colors.ink;

  const mark = filled || revealed ? '○' : wrong ? '×' : null;

  return (
    <Pressable
      onPress={onPress}
      disabled={state !== 'idle'}
      accessibilityRole="button"
      accessibilityState={{ disabled: state !== 'idle', busy: state === 'pending' }}
      accessibilityLabel={accessibilityLabel(label, state)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        minHeight: theme.controlHeight,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.md,
        borderRadius: theme.radius.md,
        borderWidth: theme.hairlineWidth,
        borderColor: border,
        backgroundColor: filled ? theme.colors.shu : theme.colors.surface,
        // Flat opacity step, no lift. `muted` recedes; `pending` reads as busy.
        opacity: state === 'muted' ? 0.4 : state === 'pending' ? 0.6 : pressed ? 0.7 : 1,
      })}
    >
      <Text
        style={{
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.bodyLarge,
          lineHeight: theme.lineHeight.bodyLarge,
          color: foreground,
        }}
      >
        {label}
      </Text>

      {/* Fixed-width slot so the labels don't shift when a mark appears. */}
      <View style={{ width: theme.spacing.xl, alignItems: 'flex-end' }}>
        {mark ? (
          <Text
            style={{
              fontFamily: theme.families.ui,
              fontSize: theme.fontSize.bodyLarge,
              color: foreground,
            }}
            // Decorative: accessibilityLabel above already says "correct".
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            {mark}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function accessibilityLabel(label: string, state: OptionState): string {
  switch (state) {
    case 'chosenRight':
      return `${label}. Correct.`;
    case 'chosenWrong':
      return `${label}. Your answer, incorrect.`;
    case 'answer':
      return `${label}. The correct answer.`;
    default:
      return label;
  }
}
