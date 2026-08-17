import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Pressable, Text } from 'react-native';

import { audioUrlForKana, audioUrlForVocab } from '@/api/audio';
import { speakJapanese } from '@/lib/japaneseSpeech';
import { useTheme } from '@/theme';

/**
 * Plays a stored course recording and falls back to the device's Japanese TTS.
 * Static audio remains the preferred, consistent voice and receives immutable
 * HTTP caching. The fallback prevents newly seeded content or a missed audio
 * deployment from turning a visible play control into a dead tap.
 */
export function SpeakButton({
  vocabId,
  kanaId,
  text,
  label = 'Play',
  speed = 1,
}: {
  /** A vocabulary item. Exactly one of this and `kanaId` is given. */
  vocabId?: string;
  /** A kana item — same bytes, different route. */
  kanaId?: string;
  /** Japanese reading used only if the stored recording is unavailable. */
  text: string;
  /** Overridden on the lesson screen, where the word itself is the context. */
  label?: string;
  speed?: number;
}) {
  const theme = useTheme();
  const player = useAudioPlayer(
    vocabId ? audioUrlForVocab(vocabId) : kanaId ? audioUrlForKana(kanaId) : null,
  );
  const status = useAudioPlayerStatus(player);

  return (
    <Pressable
      onPress={() => {
        if (status.isLoaded && !status.error) {
          // Rewind first: tapping twice replays instead of resuming midway.
          void player.seekTo(0);
          player.playbackRate = speed;
          player.play();
          return;
        }
        speakJapanese(text, { speed });
      }}
      accessibilityRole="button"
      accessibilityLabel="Play Japanese pronunciation"
      accessibilityHint={status.isLoaded ? 'Uses the course recording' : 'Uses the device Japanese voice'}
      hitSlop={theme.spacing.md}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        paddingVertical: theme.spacing.xs,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.pill,
        borderWidth: theme.hairlineWidth,
        borderColor: theme.colors.hairline,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text
        allowFontScaling={false}
        style={{
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.body,
          color: theme.colors.ai,
        }}
      >
        ▶
      </Text>
      <Text
        style={{
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.small,
          color: theme.colors.ai,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
