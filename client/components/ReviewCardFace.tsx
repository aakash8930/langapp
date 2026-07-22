import { Text, View } from 'react-native';

import type { ResolvedItem } from '@/api/items';
import { GenkouyoushiCell } from '@/components/GenkouyoushiCell';
import { KanaCells } from '@/components/KanaCells';
import { useTheme } from '@/theme';

/**
 * The two halves of a review card, split so the front can stay on screen after
 * the answer appears — you want the character in front of you while you decide
 * how well you knew it.
 *
 * A single character goes in the manuscript cell. A word or a grammar point
 * cannot: the cell holds exactly one glyph, so those are set large in plain
 * type instead of being crammed into a square they do not fit.
 */

export function CardFront({ item }: { item: ResolvedItem }) {
  switch (item.kind) {
    case 'kana':
      // Two cells for a yōon — きゃ is two glyphs and one syllable.
      return <KanaCells kana={item.kana} />;
    case 'kanji':
      return <GenkouyoushiCell character={item.char} />;
    case 'vocab':
      return <LargeJapanese text={item.lemma} />;
    case 'grammar':
      return <LargeJapanese text={item.title} />;
  }

  // No default: TypeScript checks the switch is exhaustive, so a new item kind
  // is a compile error here rather than a blank card at 6am.
}

export function CardBack({ item }: { item: ResolvedItem }) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.sm, alignItems: 'center' }}>
      {backLines(item).map((line, position) => (
        <Text
          key={position}
          style={{
            fontFamily: position === 0 ? theme.families.jaMedium : theme.families.ui,
            fontSize: position === 0 ? theme.fontSize.title : theme.fontSize.body,
            lineHeight: position === 0 ? theme.lineHeight.title : theme.lineHeight.body,
            color: position === 0 ? theme.colors.ink : theme.colors.inkSoft,
            textAlign: 'center',
          }}
        >
          {line}
        </Text>
      ))}
    </View>
  );
}

/**
 * Reading first, meaning second — that is the order they are recalled in, and
 * the first line is the one the eye lands on.
 */
function backLines(item: ResolvedItem): string[] {
  switch (item.kind) {
    case 'kana':
      // Kana have a reading and no meaning; romaji is the whole answer.
      return [item.romaji];
    case 'kanji':
      return [
        [item.on.join('、'), item.kun.join('、')].filter(Boolean).join('  ·  '),
        item.meanings.join(', '),
      ].filter(Boolean);
    case 'vocab':
      // A word written in kana *is* its own reading, and repeating it under
      // the front of the card says nothing. Once kanji arrive the two differ
      // (食べる / たべる) and the reading earns its line back.
      return item.reading === item.lemma ? [item.gloss] : [item.reading, item.gloss];
    case 'grammar': {
      // The worked example leads, because a particle is understood by seeing it
      // used and only then by reading what it does. The gap is filled in — this
      // is the answer side of the card, not the question.
      const example = item.examples[0];
      if (!example) return [item.explanation];

      return [
        example.sentence.replace('＿', example.answer),
        example.gloss,
        item.explanation,
      ];
    }
  }
}

function LargeJapanese({ text }: { text: string }) {
  const theme = useTheme();

  return (
    <Text
      style={{
        fontFamily: theme.families.ja,
        fontSize: theme.fontSize.heading,
        lineHeight: theme.lineHeight.heading,
        color: theme.colors.ink,
        textAlign: 'center',
      }}
    >
      {text}
    </Text>
  );
}
