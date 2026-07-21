import type { KanaPack, KanaSeed, LessonSeed } from './kana-pack';

/**
 * The full gojūon — all 46 base hiragana, in canonical order.
 *
 * Base characters only: no dakuten (が), handakuten (ぱ), or yōon (きゃ). Those
 * are modifications of what is here rather than new characters, and a learner
 * who knows the 46 can read them once the marks are explained — a later unit,
 * not a longer version of this one.
 *
 * Romaji is Hepburn throughout, because Hepburn is what a learner will actually
 * type: し is `shi`, not `si`.
 */
export const HIRAGANA_ROWS: Record<string, KanaSeed[]> = {
  a: [
    { kana: 'あ', romaji: 'a', row: 'a', order: 0 },
    { kana: 'い', romaji: 'i', row: 'a', order: 1 },
    { kana: 'う', romaji: 'u', row: 'a', order: 2 },
    { kana: 'え', romaji: 'e', row: 'a', order: 3 },
    { kana: 'お', romaji: 'o', row: 'a', order: 4 },
  ],
  ka: [
    { kana: 'か', romaji: 'ka', row: 'ka', order: 0 },
    { kana: 'き', romaji: 'ki', row: 'ka', order: 1 },
    { kana: 'く', romaji: 'ku', row: 'ka', order: 2 },
    { kana: 'け', romaji: 'ke', row: 'ka', order: 3 },
    { kana: 'こ', romaji: 'ko', row: 'ka', order: 4 },
  ],
  sa: [
    { kana: 'さ', romaji: 'sa', row: 'sa', order: 0 },
    // し is 'shi', not 'si' — Hepburn, because that's what a learner will type.
    { kana: 'し', romaji: 'shi', row: 'sa', order: 1 },
    { kana: 'す', romaji: 'su', row: 'sa', order: 2 },
    { kana: 'せ', romaji: 'se', row: 'sa', order: 3 },
    { kana: 'そ', romaji: 'so', row: 'sa', order: 4 },
  ],
  ta: [
    { kana: 'た', romaji: 'ta', row: 'ta', order: 0 },
    { kana: 'ち', romaji: 'chi', row: 'ta', order: 1 },
    { kana: 'つ', romaji: 'tsu', row: 'ta', order: 2 },
    { kana: 'て', romaji: 'te', row: 'ta', order: 3 },
    { kana: 'と', romaji: 'to', row: 'ta', order: 4 },
  ],
  na: [
    { kana: 'な', romaji: 'na', row: 'na', order: 0 },
    { kana: 'に', romaji: 'ni', row: 'na', order: 1 },
    { kana: 'ぬ', romaji: 'nu', row: 'na', order: 2 },
    { kana: 'ね', romaji: 'ne', row: 'na', order: 3 },
    { kana: 'の', romaji: 'no', row: 'na', order: 4 },
  ],
  ha: [
    { kana: 'は', romaji: 'ha', row: 'ha', order: 0 },
    { kana: 'ひ', romaji: 'hi', row: 'ha', order: 1 },
    // ふ is 'fu' — the consonant is a bilabial fricative, not an 'h'.
    { kana: 'ふ', romaji: 'fu', row: 'ha', order: 2 },
    { kana: 'へ', romaji: 'he', row: 'ha', order: 3 },
    { kana: 'ほ', romaji: 'ho', row: 'ha', order: 4 },
  ],
  ma: [
    { kana: 'ま', romaji: 'ma', row: 'ma', order: 0 },
    { kana: 'み', romaji: 'mi', row: 'ma', order: 1 },
    { kana: 'む', romaji: 'mu', row: 'ma', order: 2 },
    { kana: 'め', romaji: 'me', row: 'ma', order: 3 },
    { kana: 'も', romaji: 'mo', row: 'ma', order: 4 },
  ],
  // Three characters, not five: や row has no い or え column.
  ya: [
    { kana: 'や', romaji: 'ya', row: 'ya', order: 0 },
    { kana: 'ゆ', romaji: 'yu', row: 'ya', order: 1 },
    { kana: 'よ', romaji: 'yo', row: 'ya', order: 2 },
  ],
  ra: [
    { kana: 'ら', romaji: 'ra', row: 'ra', order: 0 },
    { kana: 'り', romaji: 'ri', row: 'ra', order: 1 },
    { kana: 'る', romaji: 'ru', row: 'ra', order: 2 },
    { kana: 'れ', romaji: 're', row: 'ra', order: 3 },
    { kana: 'ろ', romaji: 'ro', row: 'ra', order: 4 },
  ],
  wa: [
    { kana: 'わ', romaji: 'wa', row: 'wa', order: 0 },
    // Taught as 'wo' even though modern speech says "o", because it survives
    // only as the object particle and every textbook and IME writes `wo`.
    { kana: 'を', romaji: 'wo', row: 'wa', order: 1 },
  ],
  // The one character that is a mora on its own rather than a consonant-vowel
  // pair. It gets its own row because it belongs to none of the others.
  n: [{ kana: 'ん', romaji: 'n', row: 'n', order: 0 }],
};

/**
 * Five lessons over the eleven rows. Lesson 1 introduces the vowels alone
 * because every other row is those vowels with a consonant attached; the rest
 * take two rows each, which lands at 10–11 characters per lesson.
 *
 * The last lesson sweeps up や, ら, わ and ん together — や and わ are short
 * rows, and ん is a single character that would make a lesson of its own absurd.
 */
export const HIRAGANA_UNIT = 'hiragana-basics';

export const HIRAGANA_LESSONS: LessonSeed[] = [
  {
    order: 0,
    title: 'Hiragana: the five vowels (あ row)',
    rows: ['a'],
    exerciseTypes: ['multipleChoice'],
  },
  {
    order: 1,
    title: 'Hiragana: か and さ rows',
    rows: ['ka', 'sa'],
    exerciseTypes: ['multipleChoice'],
  },
  {
    order: 2,
    title: 'Hiragana: た and な rows',
    rows: ['ta', 'na'],
    exerciseTypes: ['multipleChoice'],
  },
  {
    order: 3,
    title: 'Hiragana: は and ま rows',
    rows: ['ha', 'ma'],
    exerciseTypes: ['multipleChoice'],
  },
  {
    order: 4,
    title: 'Hiragana: や, ら and わ rows, and ん',
    rows: ['ya', 'ra', 'wa', 'n'],
    exerciseTypes: ['multipleChoice'],
  },
];

export const HIRAGANA_PACK: KanaPack = {
  unit: HIRAGANA_UNIT,
  script: 'hiragana',
  rows: HIRAGANA_ROWS,
  lessons: HIRAGANA_LESSONS,
};
