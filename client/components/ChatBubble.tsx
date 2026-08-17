import { Text, View } from 'react-native';

import type { Correction } from '@/api/chat';
import { useTheme } from '@/theme';

/**
 * One turn of the conversation.
 *
 * The tutor speaks on the left in a surface block; the learner answers on the
 * right on an indigo ground — `ai`, the token for information and secondary
 * action, deliberately not `shu`, which is reserved for active
 * state. `paper` on `ai` clears AA in both themes (6.5:1 light, 5.7:1 dark),
 * which is why the fill can be solid rather than tinted.
 */
export function ChatBubble({
  role,
  text,
  pending,
}: {
  role: 'user' | 'assistant';
  text: string;
  /** Sent, not yet acknowledged. Dimmed rather than removed. */
  pending?: boolean;
}) {
  const theme = useTheme();
  const isUser = role === 'user';

  return (
    <View
      // The role is spoken, because left-vs-right is not information a screen
      // reader has. Without this the transcript reads as an unattributed wall.
      accessibilityRole="text"
      accessibilityLabel={`${isUser ? 'You' : 'Tutor'} said: ${text}`}
      style={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '88%',
        backgroundColor: isUser ? theme.colors.ai : theme.colors.surface,
        borderWidth: isUser ? 0 : theme.hairlineWidth,
        borderColor: theme.colors.hairline,
        borderRadius: theme.radius.lg,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        opacity: pending ? 0.6 : 1,
      }}
    >
      <Text
        style={{
          // The tutor answers in kana, so its side gets the Japanese face. The
          // learner may type romaji or English, which that face renders badly.
          fontFamily: isUser ? theme.families.ui : theme.families.ja,
          fontSize: theme.fontSize.bodyLarge,
          lineHeight: theme.lineHeight.bodyLarge,
          color: isUser ? theme.colors.paper : theme.colors.ink,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

/**
 * The corrections attached to something the learner wrote — the reason this
 * screen exists rather than being a chat window.
 *
 * Sits under the learner's own bubble and right-aligned with it, so it reads as
 * a margin note on that message rather than a reply to it. `shu` marks it,
 * never `danger`: writing a beginner sentence slightly wrong is the ordinary
 * case in practice, not an error state.
 */
export function CorrectionNote({ corrections }: { corrections: Correction[] }) {
  const theme = useTheme();

  if (corrections.length === 0) return null;

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`${corrections.length} ${
        corrections.length === 1 ? 'correction' : 'corrections'
      }: ${corrections.map((c) => `${c.span} should be ${c.fix}. ${c.note}`).join(' ')}`}
      style={{
        alignSelf: 'flex-end',
        maxWidth: '88%',
        borderLeftWidth: 2,
        borderLeftColor: theme.colors.shu,
        paddingLeft: theme.spacing.md,
        gap: theme.spacing.md,
      }}
    >
      {corrections.map((correction, index) => (
        <View
          // Index is safe here: the array is server-assigned, rendered once,
          // and never reordered or filtered.
          key={`${correction.span}-${index}`}
          // The group already reads the whole thing; the parts would repeat it.
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ gap: theme.spacing.xs }}
        >
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: theme.spacing.sm,
            }}
          >
            <Text
              style={{
                fontFamily: theme.families.ui,
                fontSize: theme.fontSize.small,
                color: theme.colors.inkSoft,
                textDecorationLine: 'line-through',
              }}
            >
              {correction.span}
            </Text>
            <Text
              style={{
                fontFamily: theme.families.ja,
                fontSize: theme.fontSize.body,
                color: theme.colors.ink,
              }}
            >
              {correction.fix}
            </Text>
          </View>
          <Text
            style={{
              fontFamily: theme.families.ui,
              fontSize: theme.fontSize.small,
              lineHeight: theme.lineHeight.small,
              color: theme.colors.inkSoft,
            }}
          >
            {correction.note}
          </Text>
        </View>
      ))}
    </View>
  );
}
