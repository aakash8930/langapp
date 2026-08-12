import type { ResolvedItem } from '../../api';
import type { WritingRecord } from '../writing/useWritingStore';
import type { LocalDeck } from './useFlashcardDecks';

export type FlashcardKind = 'kana' | 'vocabulary' | 'kanji' | 'grammar' | 'correction' | 'custom';
export type Flashcard = {
  id: string;
  kind: FlashcardKind;
  front: string;
  back: string;
  reading?: string;
  detail?: string;
  example?: string;
  sourceItemId?: string;
  tags: string[];
};

export type FlashcardDeck = {
  id: string;
  title: string;
  description: string;
  origin: 'course' | 'connected' | 'custom';
  cards: Flashcard[];
  glyph: string;
  note: string;
};

type Bookmark = { id: string; lemma: string; reading: string; gloss: string };

function grammarExample(item: Extract<ResolvedItem, { kind: 'grammar' }>): string | undefined {
  const example = item.examples[0];
  return example ? example.sentence.replace(/[＿_]+/, example.answer) : undefined;
}

export function cardFromItem(item: ResolvedItem): Flashcard {
  switch (item.kind) {
    case 'kana':
      return { id: `kana-${item.id}`, kind: 'kana', front: item.kana, back: item.romaji, detail: `${item.script} · ${item.row} row`, sourceItemId: item.id, tags: [item.script, item.row] };
    case 'vocab':
      return { id: `vocab-${item.id}`, kind: 'vocabulary', front: item.lemma, back: item.gloss, reading: item.reading, detail: `${item.pos} · ${item.jlpt}`, example: item.examples[0]?.sentence, sourceItemId: item.id, tags: [item.jlpt, item.pos] };
    case 'kanji':
      return { id: `kanji-${item.id}`, kind: 'kanji', front: item.char, back: item.meanings.join(', '), reading: [...item.on, ...item.kun].join('、'), detail: `${item.strokes} strokes · radical ${item.radical} · ${item.jlpt}`, sourceItemId: item.id, tags: [item.jlpt, item.radical] };
    case 'grammar':
      return { id: `grammar-${item.id}`, kind: 'grammar', front: item.title, back: item.explanation, detail: item.usage, example: grammarExample(item), sourceItemId: item.id, tags: [item.jlpt] };
  }
}

export function buildCourseDecks(items: ResolvedItem[]): FlashcardDeck[] {
  const hiragana = items.filter((item) => item.kind === 'kana' && item.script === 'hiragana').map(cardFromItem);
  const katakana = items.filter((item) => item.kind === 'kana' && item.script === 'katakana').map(cardFromItem);
  const vocabulary = items.filter((item) => item.kind === 'vocab').map(cardFromItem);
  const kanji = items.filter((item) => item.kind === 'kanji').map(cardFromItem);
  const grammar = items.filter((item) => item.kind === 'grammar').map(cardFromItem);
  return [
    { id: 'course-hiragana', title: 'Hiragana', description: 'Every hiragana character in the loaded curriculum.', origin: 'course', cards: hiragana, glyph: 'あ', note: 'Course curriculum' },
    { id: 'course-katakana', title: 'Katakana', description: 'Every katakana character in the loaded curriculum.', origin: 'course', cards: katakana, glyph: 'ア', note: 'Course curriculum' },
    { id: 'course-vocabulary', title: 'Course Vocabulary', description: 'Vocabulary taught by the currently loaded course units.', origin: 'course', cards: vocabulary, glyph: '語', note: 'Course corpus' },
    { id: 'course-kanji', title: 'Course Kanji', description: 'Kanji records with stored readings, meanings, radicals, and stroke counts.', origin: 'course', cards: kanji, glyph: '漢', note: 'Course corpus' },
    { id: 'course-grammar', title: 'Course Grammar', description: 'Authored grammar explanations and their stored examples.', origin: 'course', cards: grammar, glyph: '文', note: 'Course corpus' },
  ];
}

export function buildConnectedDecks(bookmarks: Bookmark[], writingRecords: WritingRecord[]): FlashcardDeck[] {
  const savedVocabulary: Flashcard[] = bookmarks.map((bookmark) => ({ id: `saved-${bookmark.id}`, kind: 'vocabulary', front: bookmark.lemma, back: bookmark.gloss, reading: bookmark.reading, sourceItemId: bookmark.id, tags: ['saved vocabulary'] }));
  const corrections: Flashcard[] = writingRecords.flatMap((record) => record.feedback.flatMap((feedback) => feedback.corrections.map((correction, index) => ({ id: `correction-${feedback.id}-${index}`, kind: 'correction' as const, front: correction.span, back: correction.fix, detail: correction.note, tags: [record.level, record.topic] }))));
  return [
    { id: 'connected-saved-vocabulary', title: 'Saved Vocabulary', description: 'Words saved from the course dictionary, Reading, and vocabulary screens.', origin: 'connected', cards: savedVocabulary, glyph: '栞', note: 'Live vocabulary bookmarks' },
    { id: 'connected-writing-corrections', title: 'Writing Corrections', description: 'Exact corrections returned for writing stored in this browser.', origin: 'connected', cards: corrections, glyph: '直', note: 'Live Writing feedback' },
  ];
}

export function deckFromLocal(deck: LocalDeck): FlashcardDeck {
  return {
    id: deck.id,
    title: deck.name,
    description: deck.description || 'A custom deck stored in this browser.',
    origin: 'custom',
    cards: deck.cards.map((card) => ({ ...card, kind: 'custom' as const })),
    glyph: '札',
    note: 'Browser-local custom deck',
  };
}

export function flashcardKindLabel(kind: FlashcardKind): string {
  if (kind === 'vocabulary') return 'Vocabulary';
  if (kind === 'correction') return 'Correction';
  return kind.charAt(0).toLocaleUpperCase() + kind.slice(1);
}
