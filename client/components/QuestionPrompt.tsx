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
 * instead. Same decision the study card makes, for the same reason.
 *
 * A kanji is one glyph too, but it does **not** get a genkouyoushi cell: the cell
 * is ruled with the quadrant guides a learner uses to place kana, and a kanji
 * sitting inside them reads as a character being written rather than one being
 * recognised — which is the wrong question here, since this unit asks for meaning.
 * It is set at `displayKanji` (56) rather than `displayKana` (72) because a kanji
 * packs far more detail into the same box; 顔 has 18 strokes where the busiest
 * kana has 4, so the same point size that flatters a kana turns a kanji into a
 * smudge.
 */
export function QuestionPrompt({ prompt, kind }: { prompt: string; kind: PromptKind }) {
  const theme = useTheme();

  // One cell, or two for a yōon like きゃ.
  if (kind === 'kana') {
    return <KanaCells kana={prompt} />;
  }

  if (kind === 'kanji') {
    return (
      <Text
        style={{
          fontFamily: theme.families.jaMedium,
          fontSize: theme.fontSize.displayKanji,
          // No lineHeight token goes this large, and a display glyph does not
          // need one: it is a single line, and letting it size itself avoids
          // clipping the ascenders on a dense character.
          color: theme.colors.ink,
          textAlign: 'center',
        }}
      >
        {prompt}
      </Text>
    );
  }

  return (
    <Text
      // `heading` for a word, matching the study card's word face on purpose:
      // a word is read, not inspected, so it does not need the size a single
      // glyph does — and こんにちは at display size would wrap mid-word on a
      // narrow phone. A sentence steps down again: it is longer, it must wrap
      // cleanly, and the gap is what the eye needs to find, not the size.
      style={{
        fontFamily: theme.families.jaMedium,
        fontSize: kind === 'grammar' ? theme.fontSize.title : theme.fontSize.heading,
        lineHeight: kind === 'grammar' ? theme.lineHeight.title : theme.lineHeight.heading,
        color: theme.colors.ink,
        textAlign: 'center',
      }}
    >
      {prompt}
    </Text>
  );
}
