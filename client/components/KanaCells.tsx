import { View } from 'react-native';

import { GenkouyoushiCell } from '@/components/GenkouyoushiCell';
import { useTheme } from '@/theme';

/**
 * One kana syllable, in as many manuscript cells as it takes.
 *
 * A yōon is two glyphs — きゃ is き followed by a small ゃ — and on real
 * genkouyoushi paper it occupies two squares, one per glyph. So does this: the
 * cell is ruled for a single character and cramming two into it would be both
 * wrong and illegible. Splitting also keeps the small ゃ visibly small, which is
 * the entire distinction between きゃ (*kya*, one mora) and きや (*kiya*, two).
 *
 * Cells shrink when there are two of them, so a pair occupies about the width a
 * single cell would — the prompt stays the same optical size whichever it is.
 */
/**
 * GenkouyoushiCell's own default is 200. A pair is set at 58% of that so two
 * cells plus the gap between them land near the width of one — expressed as a
 * ratio rather than a second loose number, so the two stay related if the cell
 * default ever changes.
 */
const SINGLE_CELL = 200;
const PAIR_RATIO = 0.58;

export function KanaCells({ kana }: { kana: string }) {
  const theme = useTheme();
  const glyphs = [...kana];

  if (glyphs.length === 1) {
    return <GenkouyoushiCell character={kana} />;
  }

  return (
    <View
      // Read as one syllable, not two characters — the screen reader should say
      // "きゃ", and the cells are presentation.
      accessibilityRole="text"
      accessibilityLabel={kana}
      style={{ flexDirection: 'row', gap: theme.spacing.sm }}
    >
      {glyphs.map((glyph, position) => (
        <GenkouyoushiCell
          key={`${position}-${glyph}`}
          character={glyph}
          size={SINGLE_CELL * PAIR_RATIO}
        />
      ))}
    </View>
  );
}
