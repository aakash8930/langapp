import type { KanaPack, KanaSeed, LessonSeed } from './kana-pack';

/**
 * The marked katakana — the same 58 syllables as the hiragana marks unit, glyph
 * for glyph and romaji for romaji. A test asserts that mirroring rather than
 * trusting it, which is the only practical way to catch one wrong character in
 * a table this size.
 *
 * Same three mechanisms (dakuten, handakuten, yōon), same two romaji collisions
 * (ヂ = ジ = *ji*, ヅ = ズ = *zu*), same absences (ッ and ー are marks rather
 * than syllables). See `hiragana-marks.ts` for the reasoning, which is not
 * repeated here.
 *
 * Katakana adds one wrinkle hiragana does not have: ヂ and ヅ are rarer still,
 * because loanwords reach for ジ and ズ. They are here for completeness of the
 * table, not because a learner will meet them often.
 */
export const KATAKANA_MARKS_ROWS: Record<string, KanaSeed[]> = {
  ga: [
    { kana: 'ガ', romaji: 'ga', row: 'ga', order: 0 },
    { kana: 'ギ', romaji: 'gi', row: 'ga', order: 1 },
    { kana: 'グ', romaji: 'gu', row: 'ga', order: 2 },
    { kana: 'ゲ', romaji: 'ge', row: 'ga', order: 3 },
    { kana: 'ゴ', romaji: 'go', row: 'ga', order: 4 },
  ],
  za: [
    { kana: 'ザ', romaji: 'za', row: 'za', order: 0 },
    { kana: 'ジ', romaji: 'ji', row: 'za', order: 1 },
    { kana: 'ズ', romaji: 'zu', row: 'za', order: 2 },
    { kana: 'ゼ', romaji: 'ze', row: 'za', order: 3 },
    { kana: 'ゾ', romaji: 'zo', row: 'za', order: 4 },
  ],
  da: [
    { kana: 'ダ', romaji: 'da', row: 'da', order: 0 },
    { kana: 'ヂ', romaji: 'ji', row: 'da', order: 1 },
    { kana: 'ヅ', romaji: 'zu', row: 'da', order: 2 },
    { kana: 'デ', romaji: 'de', row: 'da', order: 3 },
    { kana: 'ド', romaji: 'do', row: 'da', order: 4 },
  ],
  ba: [
    { kana: 'バ', romaji: 'ba', row: 'ba', order: 0 },
    { kana: 'ビ', romaji: 'bi', row: 'ba', order: 1 },
    { kana: 'ブ', romaji: 'bu', row: 'ba', order: 2 },
    { kana: 'ベ', romaji: 'be', row: 'ba', order: 3 },
    { kana: 'ボ', romaji: 'bo', row: 'ba', order: 4 },
  ],
  pa: [
    { kana: 'パ', romaji: 'pa', row: 'pa', order: 0 },
    { kana: 'ピ', romaji: 'pi', row: 'pa', order: 1 },
    { kana: 'プ', romaji: 'pu', row: 'pa', order: 2 },
    { kana: 'ペ', romaji: 'pe', row: 'pa', order: 3 },
    { kana: 'ポ', romaji: 'po', row: 'pa', order: 4 },
  ],
  kya: [
    { kana: 'キャ', romaji: 'kya', row: 'kya', order: 0 },
    { kana: 'キュ', romaji: 'kyu', row: 'kya', order: 1 },
    { kana: 'キョ', romaji: 'kyo', row: 'kya', order: 2 },
  ],
  sha: [
    { kana: 'シャ', romaji: 'sha', row: 'sha', order: 0 },
    { kana: 'シュ', romaji: 'shu', row: 'sha', order: 1 },
    { kana: 'ショ', romaji: 'sho', row: 'sha', order: 2 },
  ],
  cha: [
    { kana: 'チャ', romaji: 'cha', row: 'cha', order: 0 },
    { kana: 'チュ', romaji: 'chu', row: 'cha', order: 1 },
    { kana: 'チョ', romaji: 'cho', row: 'cha', order: 2 },
  ],
  nya: [
    { kana: 'ニャ', romaji: 'nya', row: 'nya', order: 0 },
    { kana: 'ニュ', romaji: 'nyu', row: 'nya', order: 1 },
    { kana: 'ニョ', romaji: 'nyo', row: 'nya', order: 2 },
  ],
  hya: [
    { kana: 'ヒャ', romaji: 'hya', row: 'hya', order: 0 },
    { kana: 'ヒュ', romaji: 'hyu', row: 'hya', order: 1 },
    { kana: 'ヒョ', romaji: 'hyo', row: 'hya', order: 2 },
  ],
  mya: [
    { kana: 'ミャ', romaji: 'mya', row: 'mya', order: 0 },
    { kana: 'ミュ', romaji: 'myu', row: 'mya', order: 1 },
    { kana: 'ミョ', romaji: 'myo', row: 'mya', order: 2 },
  ],
  rya: [
    { kana: 'リャ', romaji: 'rya', row: 'rya', order: 0 },
    { kana: 'リュ', romaji: 'ryu', row: 'rya', order: 1 },
    { kana: 'リョ', romaji: 'ryo', row: 'rya', order: 2 },
  ],
  gya: [
    { kana: 'ギャ', romaji: 'gya', row: 'gya', order: 0 },
    { kana: 'ギュ', romaji: 'gyu', row: 'gya', order: 1 },
    { kana: 'ギョ', romaji: 'gyo', row: 'gya', order: 2 },
  ],
  ja: [
    { kana: 'ジャ', romaji: 'ja', row: 'ja', order: 0 },
    { kana: 'ジュ', romaji: 'ju', row: 'ja', order: 1 },
    { kana: 'ジョ', romaji: 'jo', row: 'ja', order: 2 },
  ],
  bya: [
    { kana: 'ビャ', romaji: 'bya', row: 'bya', order: 0 },
    { kana: 'ビュ', romaji: 'byu', row: 'bya', order: 1 },
    { kana: 'ビョ', romaji: 'byo', row: 'bya', order: 2 },
  ],
  pya: [
    { kana: 'ピャ', romaji: 'pya', row: 'pya', order: 0 },
    { kana: 'ピュ', romaji: 'pyu', row: 'pya', order: 1 },
    { kana: 'ピョ', romaji: 'pyo', row: 'pya', order: 2 },
  ],
};

export const KATAKANA_MARKS_UNIT = 'katakana-marks';

/** Split exactly as the hiragana marks unit is, for the same reasons. */
export const KATAKANA_MARKS_LESSONS: LessonSeed[] = [
  {
    order: 0,
    title: 'Dakuten: ガ and ザ rows',
    rows: ['ga', 'za'],
    exerciseTypes: ['multipleChoice'],
  },
  {
    order: 1,
    title: 'Dakuten: ダ and バ rows',
    rows: ['da', 'ba'],
    exerciseTypes: ['multipleChoice'],
  },
  {
    order: 2,
    title: 'Handakuten: the パ row',
    rows: ['pa'],
    exerciseTypes: ['multipleChoice'],
  },
  {
    order: 3,
    title: 'Yōon: キャ, シャ and チャ',
    rows: ['kya', 'sha', 'cha'],
    exerciseTypes: ['multipleChoice'],
  },
  {
    order: 4,
    title: 'Yōon: ニャ, ヒャ, ミャ and リャ',
    rows: ['nya', 'hya', 'mya', 'rya'],
    exerciseTypes: ['multipleChoice'],
  },
  {
    order: 5,
    title: 'Yōon with dakuten: ギャ, ジャ, ビャ and ピャ',
    rows: ['gya', 'ja', 'bya', 'pya'],
    exerciseTypes: ['multipleChoice'],
  },
];

export const KATAKANA_MARKS_PACK: KanaPack = {
  unit: KATAKANA_MARKS_UNIT,
  script: 'katakana',
  rows: KATAKANA_MARKS_ROWS,
  lessons: KATAKANA_MARKS_LESSONS,
};
