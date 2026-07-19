/**
 * The gojūon rows あ through な — 25 characters, in canonical order.
 * `order` is the position within the row, so あいうえお never renders scrambled.
 */
export interface KanaSeed {
  kana: string;
  romaji: string;
  row: string;
  order: number;
}

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
};

/**
 * Three lessons over five rows. Lesson 1 introduces the vowels alone because
 * every other row is those vowels with a consonant attached; 2 and 3 then take
 * two rows each.
 */
export interface LessonSeed {
  order: number;
  title: string;
  rows: string[];
  exerciseTypes: string[];
}

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
];
