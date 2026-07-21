import type { KanaPack, KanaSeed, LessonSeed } from './kana-pack';

/**
 * The full katakana gojūon — all 46 base characters, mirroring hiragana row for
 * row and romaji for romaji. Same table, different glyphs.
 *
 * Base characters only, and Hepburn throughout, for the same reasons as
 * hiragana: no dakuten (ガ), handakuten (パ), yōon (キャ), and no chōonpu (ー),
 * which is a length mark rather than a character. The extended katakana used
 * for foreign sounds (ヴ, ファ, ティ) are combinations, not new glyphs.
 *
 * Katakana's real difficulty is not the count, it is the confusable pairs —
 * シ/ツ, ソ/ン, ク/ワ, ノ/メ. Nothing here needs to special-case them: exercise
 * distractors are drawn from the whole unit pool, so シ's options naturally
 * include ツ, which is exactly the discrimination worth drilling.
 */
export const KATAKANA_ROWS: Record<string, KanaSeed[]> = {
  a: [
    { kana: 'ア', romaji: 'a', row: 'a', order: 0 },
    { kana: 'イ', romaji: 'i', row: 'a', order: 1 },
    { kana: 'ウ', romaji: 'u', row: 'a', order: 2 },
    { kana: 'エ', romaji: 'e', row: 'a', order: 3 },
    { kana: 'オ', romaji: 'o', row: 'a', order: 4 },
  ],
  ka: [
    { kana: 'カ', romaji: 'ka', row: 'ka', order: 0 },
    { kana: 'キ', romaji: 'ki', row: 'ka', order: 1 },
    { kana: 'ク', romaji: 'ku', row: 'ka', order: 2 },
    { kana: 'ケ', romaji: 'ke', row: 'ka', order: 3 },
    { kana: 'コ', romaji: 'ko', row: 'ka', order: 4 },
  ],
  sa: [
    { kana: 'サ', romaji: 'sa', row: 'sa', order: 0 },
    // シ, not ツ. The strokes come off the *left* and sweep up; ツ's come off
    // the top and sweep down. This pair is the classic katakana confusion.
    { kana: 'シ', romaji: 'shi', row: 'sa', order: 1 },
    { kana: 'ス', romaji: 'su', row: 'sa', order: 2 },
    { kana: 'セ', romaji: 'se', row: 'sa', order: 3 },
    { kana: 'ソ', romaji: 'so', row: 'sa', order: 4 },
  ],
  ta: [
    { kana: 'タ', romaji: 'ta', row: 'ta', order: 0 },
    { kana: 'チ', romaji: 'chi', row: 'ta', order: 1 },
    { kana: 'ツ', romaji: 'tsu', row: 'ta', order: 2 },
    { kana: 'テ', romaji: 'te', row: 'ta', order: 3 },
    { kana: 'ト', romaji: 'to', row: 'ta', order: 4 },
  ],
  na: [
    { kana: 'ナ', romaji: 'na', row: 'na', order: 0 },
    { kana: 'ニ', romaji: 'ni', row: 'na', order: 1 },
    { kana: 'ヌ', romaji: 'nu', row: 'na', order: 2 },
    { kana: 'ネ', romaji: 'ne', row: 'na', order: 3 },
    { kana: 'ノ', romaji: 'no', row: 'na', order: 4 },
  ],
  ha: [
    { kana: 'ハ', romaji: 'ha', row: 'ha', order: 0 },
    { kana: 'ヒ', romaji: 'hi', row: 'ha', order: 1 },
    { kana: 'フ', romaji: 'fu', row: 'ha', order: 2 },
    { kana: 'ヘ', romaji: 'he', row: 'ha', order: 3 },
    { kana: 'ホ', romaji: 'ho', row: 'ha', order: 4 },
  ],
  ma: [
    { kana: 'マ', romaji: 'ma', row: 'ma', order: 0 },
    { kana: 'ミ', romaji: 'mi', row: 'ma', order: 1 },
    { kana: 'ム', romaji: 'mu', row: 'ma', order: 2 },
    { kana: 'メ', romaji: 'me', row: 'ma', order: 3 },
    { kana: 'モ', romaji: 'mo', row: 'ma', order: 4 },
  ],
  // Three characters, not five: ヤ row has no い or え column.
  ya: [
    { kana: 'ヤ', romaji: 'ya', row: 'ya', order: 0 },
    { kana: 'ユ', romaji: 'yu', row: 'ya', order: 1 },
    { kana: 'ヨ', romaji: 'yo', row: 'ya', order: 2 },
  ],
  ra: [
    { kana: 'ラ', romaji: 'ra', row: 'ra', order: 0 },
    { kana: 'リ', romaji: 'ri', row: 'ra', order: 1 },
    { kana: 'ル', romaji: 'ru', row: 'ra', order: 2 },
    { kana: 'レ', romaji: 're', row: 'ra', order: 3 },
    { kana: 'ロ', romaji: 'ro', row: 'ra', order: 4 },
  ],
  wa: [
    { kana: 'ワ', romaji: 'wa', row: 'wa', order: 0 },
    // ヲ is vanishingly rare in modern katakana — the particle it writes is
    // written を. Included because the table is incomplete without it and a
    // learner will meet it in furigana and older text.
    { kana: 'ヲ', romaji: 'wo', row: 'wa', order: 1 },
  ],
  // ン, the pair to ソ. Same rule as ソ/シ: the stroke direction is the tell.
  n: [{ kana: 'ン', romaji: 'n', row: 'n', order: 0 }],
};

export const KATAKANA_UNIT = 'katakana-basics';

/**
 * Five lessons, split exactly as hiragana's are. Deliberately parallel: a
 * learner arriving here already knows the shape of the table, and the only new
 * thing is the glyphs. A different grouping would suggest a difference that
 * isn't there.
 */
export const KATAKANA_LESSONS: LessonSeed[] = [
  {
    order: 0,
    title: 'Katakana: the five vowels (ア row)',
    rows: ['a'],
    exerciseTypes: ['multipleChoice'],
  },
  {
    order: 1,
    title: 'Katakana: カ and サ rows',
    rows: ['ka', 'sa'],
    exerciseTypes: ['multipleChoice'],
  },
  {
    order: 2,
    title: 'Katakana: タ and ナ rows',
    rows: ['ta', 'na'],
    exerciseTypes: ['multipleChoice'],
  },
  {
    order: 3,
    title: 'Katakana: ハ and マ rows',
    rows: ['ha', 'ma'],
    exerciseTypes: ['multipleChoice'],
  },
  {
    order: 4,
    title: 'Katakana: ヤ, ラ and ワ rows, and ン',
    rows: ['ya', 'ra', 'wa', 'n'],
    exerciseTypes: ['multipleChoice'],
  },
];

export const KATAKANA_PACK: KanaPack = {
  unit: KATAKANA_UNIT,
  script: 'katakana',
  rows: KATAKANA_ROWS,
  lessons: KATAKANA_LESSONS,
};
