import type { GrammarItem, VocabItem } from '../library/useCorpus';

export type ReadingKind = 'word' | 'context' | 'grammar';
export type ReadingEntry = {
  id: string;
  kind: ReadingKind;
  sourceId: string;
  sourceTitle: string;
  sentence: string;
  reading?: string;
  romaji?: string;
  translation: string;
  jlpt: string;
  characters: number;
  label: string;
};

export type ReadingToken =
  | { kind: 'text'; value: string; key: string }
  | { kind: 'vocab'; value: string; item: VocabItem; key: string };

export function fillGrammarBlank(sentence: string, answer: string): string {
  return sentence.replace(/[＿_]+/, answer);
}

export function countJapaneseCharacters(value: string): number {
  return [...value].filter((character) => /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}々ー]/u.test(character)).length;
}

export function buildReadingEntries(vocab: VocabItem[], grammar: GrammarItem[]): ReadingEntry[] {
  const entries: ReadingEntry[] = [];
  for (const item of vocab) {
    entries.push({
      id: `word-${item.id}`,
      kind: 'word',
      sourceId: item.id,
      sourceTitle: item.lemma,
      sentence: item.lemma,
      reading: item.reading,
      romaji: item.romaji,
      translation: item.gloss,
      jlpt: item.jlpt,
      characters: countJapaneseCharacters(item.lemma),
      label: item.pos,
    });
    item.examples.forEach((example, index) => {
      entries.push({
        id: `context-${item.id}-${index}`,
        kind: 'context',
        sourceId: item.id,
        sourceTitle: item.lemma,
        sentence: example.sentence,
        reading: example.reading,
        romaji: example.romaji,
        translation: example.gloss,
        jlpt: item.jlpt,
        characters: countJapaneseCharacters(example.sentence),
        label: `Context for ${item.lemma}`,
      });
    });
  }
  for (const point of grammar) {
    point.examples.forEach((example, index) => {
      const sentence = fillGrammarBlank(example.sentence, example.answer);
      entries.push({
        id: `grammar-${point.id}-${index}`,
        kind: 'grammar',
        sourceId: point.id,
        sourceTitle: point.title,
        sentence,
        romaji: example.romaji,
        translation: example.gloss,
        jlpt: point.jlpt,
        characters: countJapaneseCharacters(sentence),
        label: point.title,
      });
    });
  }
  return entries;
}

function containsKanji(value: string): boolean {
  return /\p{Script=Han}/u.test(value);
}

/**
 * Longest-match segmentation over the actual course vocabulary. It is not a
 * general Japanese tokenizer; unmatched characters remain ordinary text.
 */
export function tokenizeWithCourseVocab(sentence: string, vocab: VocabItem[]): ReadingToken[] {
  const candidates = vocab
    .flatMap((item) => [item.lemma, item.reading]
      .filter((face, index, faces) => face && faces.indexOf(face) === index)
      .filter((face) => [...face].length >= 2 || containsKanji(face))
      .map((face) => ({ face, item })))
    .sort((left, right) => [...right.face].length - [...left.face].length);
  const tokens: ReadingToken[] = [];
  let index = 0;
  let plain = '';
  let plainStart = 0;

  function flushPlain() {
    if (!plain) return;
    tokens.push({ kind: 'text', value: plain, key: `text-${plainStart}` });
    plain = '';
  }

  while (index < sentence.length) {
    const match = candidates.find((candidate) => sentence.startsWith(candidate.face, index));
    if (!match) {
      if (!plain) plainStart = index;
      const character = String.fromCodePoint(sentence.codePointAt(index) ?? 0);
      plain += character;
      index += character.length;
      continue;
    }
    flushPlain();
    tokens.push({ kind: 'vocab', value: match.face, item: match.item, key: `vocab-${index}-${match.item.id}` });
    index += match.face.length;
  }
  flushPlain();
  return tokens;
}

export function readingKindLabel(kind: ReadingKind): string {
  if (kind === 'word') return 'Course word';
  if (kind === 'grammar') return 'Grammar example';
  return 'Context sentence';
}
