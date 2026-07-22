import { Text } from 'react-native';

import type { PromptKind } from '@/api/exercises';
import { KanaCells } from '@/components/KanaCells';
import { useTheme } from '@/theme';

/**
 * The thing being asked about, sized to what it is.
 *
 * A kana question is one glyph and goes in a manuscript cell — the cell is
 * ruled for exactly one character and holds nothing else. A vocabulary word is
 * three or four characters and would either overflow that square or be shrunk
 * until the point of the cell is lost, so it is set large in plain type
 * instead. Same decision the review card makes, for the same reason.
 */
export function QuestionPrompt({ prompt, kind }: { prompt: string; kind: PromptKind }) {
  const theme = useTheme();

  // One cell, or two for a yōon like きゃ.
  if (kind === 'kana') {
    return <KanaCells kana={prompt} />;
  }

  return (
    <Text
      // `heading`, matching the review card's word face on purpose: a word is
      // read, not inspected, so it does not need the size a single glyph does —
      // and こんにちは at display size would wrap mid-word on a narrow phone,
      // which is worse than being smaller. The same word must not change size
      // between the quiz and the review card.
      style={{
        fontFamily: theme.families.jaMedium,
        fontSize: theme.fontSize.heading,
        lineHeight: theme.lineHeight.heading,
        color: theme.colors.ink,
        textAlign: 'center',
      }}
    >
      {prompt}
    </Text>
  );
}
