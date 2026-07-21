import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/theme';

/**
 * The way in to the AI conversation, sitting under the review callout.
 *
 * Deliberately quieter than that one — a hairline block, not a solid fill.
 * Review has to out-shout everything because SRS collapses if due cards go
 * uncleared; conversation practice is the reward for having done it, and
 * putting two loud surfaces in a row would leave neither of them loud.
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
