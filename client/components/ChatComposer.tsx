import { Pressable, Text, TextInput, View } from 'react-native';

import { COUNTER_VISIBLE_FROM, MESSAGE_MAX_LENGTH } from '@/lib/chat';
import { useTheme } from '@/theme';

/**
 * The message box and its send control.
 *
 * `maxLength` is the server's 500-char cap, enforced here so the field simply
 * stops accepting rather than letting someone write a paragraph and be told no
 * by a 400. The counter stays hidden until it is nearly relevant — a beginner
 * writing "watashi wa Aakash desu" never needs to see it.
 */
export function ChatComposer({
  value,
  onChangeText,
  onSend,
  disabled,
  sending,
}: {
  value: string;
  onChangeText: (next: string) => void;
  onSend: () => void;
  /** The session is over — composing is pointless, not merely blocked. */
  disabled?: boolean;
  /** A turn is in flight. Sends are serialised; there is never a second one. */
  sending?: boolean;
}) {
  const theme = useTheme();
  const trimmed = value.trim();
  const canSend = trimmed.length > 0 && !sending && !disabled;
  const showCounter = value.length >= COUNTER_VISIBLE_FROM;

  return (
    <View
      style={{
        gap: theme.spacing.sm,
        paddingTop: theme.spacing.md,
        borderTopWidth: theme.hairlineWidth,
        borderTopColor: theme.colors.hairline,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.md }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          editable={!disabled}
          multiline
          maxLength={MESSAGE_MAX_LENGTH}
          placeholder={disabled ? 'This chat is finished' : 'Write in Japanese, romaji, or English'}
          placeholderTextColor={theme.colors.inkSoft}
          accessibilityLabel="Your message"
          accessibilityHint="Romaji and English are both fine — the tutor answers in hiragana."
          // Return inserts a newline instead of sending: a wrong send costs a
          // real LLM call and a turn of the session's 50, so it stays a
          // deliberate tap on a named button.
          style={{
            flex: 1,
            minHeight: theme.controlHeight,
            maxHeight: 120,
            borderWidth: theme.hairlineWidth,
            borderColor: theme.colors.hairline,
            borderRadius: theme.radius.md,
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.md,
            paddingBottom: theme.spacing.md,
            backgroundColor: theme.colors.surface,
            color: theme.colors.ink,
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.body,
            opacity: disabled ? 0.5 : 1,
          }}
        />

        <Pressable
          onPress={onSend}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          accessibilityState={{ disabled: !canSend, busy: sending }}
          style={({ pressed }) => ({
            height: theme.controlHeight,
            justifyContent: 'center',
            paddingHorizontal: theme.spacing.xl,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.ink,
            opacity: !canSend ? 0.4 : pressed ? 0.7 : 1,
          })}
        >
          <Text
            style={{
              fontFamily: theme.families.ui,
              fontSize: theme.fontSize.body,
              color: theme.colors.paper,
            }}
          >
            {sending ? 'Sending' : 'Send'}
          </Text>
        </Pressable>
      </View>

      {showCounter ? (
        <Text
          style={{
            alignSelf: 'flex-end',
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.caption,
            color:
              value.length >= MESSAGE_MAX_LENGTH ? theme.colors.danger : theme.colors.inkSoft,
            ...theme.tabularFigures,
          }}
        >
          {value.length} / {MESSAGE_MAX_LENGTH}
        </Text>
      ) : null}
    </View>
  );
}
