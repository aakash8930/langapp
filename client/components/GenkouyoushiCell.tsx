import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';

type Props = {
  /** A single kana or kanji. */
  character: string;
  /** Outer edge of the square, in points. */
  size?: number;
};

/**
 * A single genkouyoushi manuscript cell — thin vermilion square with faint
 * centre registration marks, the way Japanese composition paper is ruled.
 *
 * Character display only. This is never page decoration: one cell holds one
 * character on an exercise card, and that is the whole of its job.
 */
export function GenkouyoushiCell({ character, size = 200 }: Props) {
  const theme = useTheme();

  // The registration marks are the same vermilion as the rule, dropped to a
  // whisper so they guide the eye without competing with the glyph.
  const mark = { backgroundColor: theme.colors.shu, opacity: 0.28 } as const;

  // Kana carry less stroke detail than kanji, so they are set larger to keep
  // the optical weight inside the cell even.
  const isKana = /^[぀-ヿ]$/.test(character);
  const fontSize = isKana ? theme.fontSize.displayKana : theme.fontSize.displayKanji;

  return (
    <View
      style={[
        styles.cell,
        {
          width: size,
          height: size,
          borderColor: theme.colors.shu,
          borderWidth: theme.hairlineWidth,
        },
      ]}
    >
      <View style={[styles.markVertical, mark, { width: theme.hairlineWidth }]} />
      <View style={[styles.markHorizontal, mark, { height: theme.hairlineWidth }]} />
      <Text
        // Zen Kaku Gothic New only — the system face would substitute a Chinese
        // glyph variant for several kanji.
        style={{ fontFamily: theme.families.ja, fontSize, color: theme.colors.ink }}
        // Large display glyphs must not shrink to fit; the cell sizes to them.
        allowFontScaling={false}
      >
        {character}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  markHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
