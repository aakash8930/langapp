import { useAudioPlayer } from 'expo-audio';
import { Pressable, Text } from 'react-native';

import { audioUrlForKana, audioUrlForVocab } from '@/api/audio';
import { useTheme } from '@/theme';

/**
 * Plays a word aloud.
 *
 * ## Why the URL goes straight to the player
 *
 * The audio route is unauthenticated — shared reference content, like `/lessons`
 * — so `expo-audio` can fetch it itself. Streaming bytes through the app's
 * authenticated `apiFetch` would mean buffering a whole file in JS to hand to a
 * player that is perfectly capable of fetching it, and would lose HTTP caching.
 * The server sends `immutable` with a one-year max-age, so each word is fetched
 * once ever.
 *
 * ## Failure is silence, not an error
 *
 * A word whose audio has not been generated yet 404s, and the API being asleep
 * fails the same way. Neither is worth an error banner in the middle of a quiz:
 * the button is a supplement to a written word that is already on screen, so a
 * dead tap costs the learner nothing. `expo-audio` swallows the load failure and
 * the button simply does not sound.
 */
export function SpeakButton({
  vocabId,
  kanaId,
  label = 'Play',
}: {
  /** A vocabulary item. Exactly one of this and `kanaId` is given. */
  vocabId?: string;
  /** A kana item — same bytes, different route. */
  kanaId?: string;
  /** Overridden on the lesson screen, where the word itself is the context. */
  label?: string;
}) {
  const theme = useTheme();
  const player = useAudioPlayer(
    vocabId ? audioUrlForVocab(vocabId) : kanaId ? audioUrlForKana(kanaId) : null,
  );

  return (
    <Pressable
      onPress={() => {
        // Rewind first: tapping twice should replay from the start, not resume
        // from wherever the previous play ended.
        player.seekTo(0);
        player.play();
      }}
      accessibilityRole="button"
      accessibilityLabel="Play this"
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
        {/* A text glyph rather than an icon font — one less dependency, and it
            takes the palette colour, which an emoji speaker would not. */}
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
