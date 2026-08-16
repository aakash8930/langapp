import { useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';

import { japaneseForSpeech, speakJapanese, stopJapaneseSpeech } from '@/lib/japaneseSpeech';
import { useTheme } from '@/theme';

export function JapaneseSpeechButton({
  text,
  speed = 1,
  label = 'Hear reply',
}: {
  text: string;
  speed?: number;
  label?: string;
}) {
  const theme = useTheme();
  const [speaking, setSpeaking] = useState(false);
  const available = japaneseForSpeech(text).length > 0;

  useEffect(() => () => {
    void stopJapaneseSpeech();
  }, [text]);

  async function toggle() {
    if (!available) return;
    if (speaking) {
      await stopJapaneseSpeech();
      setSpeaking(false);
      return;
    }
    const started = speakJapanese(text, {
      speed,
      onDone: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
    setSpeaking(started);
  }

  return (
    <Pressable
      onPress={() => void toggle()}
      disabled={!available}
      accessibilityRole="button"
      accessibilityLabel={speaking ? 'Stop Japanese speech' : label}
      style={({ pressed }) => ({
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        paddingVertical: theme.spacing.xs,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.pill,
        borderWidth: theme.hairlineWidth,
        borderColor: theme.colors.hairline,
        opacity: !available ? 0.45 : pressed ? 0.6 : 1,
      })}
    >
      <Text style={{ color: theme.colors.ai }}>{speaking ? '■' : '▶'}</Text>
      <Text style={{ fontFamily: theme.families.ui, fontSize: theme.fontSize.small, color: theme.colors.ai }}>
        {speaking ? 'Stop' : label}
      </Text>
    </Pressable>
  );
}
