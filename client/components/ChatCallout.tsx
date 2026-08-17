import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/theme';

/**
 * The way in to the AI conversation, shown after course progress.
 *
 * Deliberately quiet: a hairline block rather than another dominant dashboard
 * card. Conversation is optional support beside the primary course path.
 */
export function ChatCallout({ onPress }: { onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Practise a conversation with the AI tutor"
      style={({ pressed }) => ({
        borderWidth: theme.hairlineWidth,
        borderColor: theme.colors.hairline,
        borderRadius: theme.radius.lg,
        padding: theme.spacing.xl,
        gap: theme.spacing.xs,
        backgroundColor: theme.colors.surface,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: theme.spacing.md,
        }}
      >
        <Text
          style={{
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.bodyLarge,
            color: theme.colors.ink,
          }}
        >
          Practise a conversation
        </Text>
        <Text
          style={{
            fontFamily: theme.families.ja,
            fontSize: theme.fontSize.small,
            color: theme.colors.inkSoft,
          }}
        >
          AI会話
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
        Introduce yourself to a Japanese speaker. Romaji is fine — you’ll be corrected as
        you go.
      </Text>
    </Pressable>
  );
}
