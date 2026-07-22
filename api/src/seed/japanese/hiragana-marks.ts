import type { KanaPack, KanaSeed, LessonSeed } from './kana-pack';

/**
 * The marked hiragana: 58 syllables built from characters already taught.
 *
 * Three mechanisms, in the order they are introduced:
 *
 * - **dakuten** (゛) voices a consonant — か ka becomes が ga. 20 syllables.
 * - **handakuten** (゜) turns は into ぱ. 5 syllables, one row.
 * - **yōon** (拗音) glues a small ゃゅょ to an -i syllable, fusing two glyphs
 *   into one mora — き + ゃ is *kya*, one beat, not "ki-ya". 33 combinations.
 *
 * Nothing here is a new glyph except the small ゃゅょ. That is the pedagogical
 * point, and it is why this is a separate unit rather than more rows bolted
 * onto the base table: a learner is not memorising 58 new shapes, they are
 * learning three rules.
 *
 * ## Two romaji collisions, and why they stay
 *
 * じ and ぢ are both *ji*; ず and づ are both *zu*. Modern Japanese uses じ and
 * ず almost always — ぢ and づ survive in a handful of compounds — but they are
 * real characters and a reader meets them. The exercise generator already
 * deduplicates distractors by answer text (it was written expecting exactly
 * this), so a question about ぢ will never also offer じ.
 *
 * ## What is deliberately absent
 *
 * っ (sokuon) and ー (chōonpu) are **not here**. Both are marks rather than
 * syllables: っ doubles the following consonant and has no reading of its own,
 * and ー lengthens the preceding vowel. Neither can answer "which romaji
 * matches this character", which is the only question this app can ask today.
 * Teaching them needs an exercise type that does not exist yet — see
 * OPEN-ITEMS. They are the reason がっこう and コーヒー are still unreadable.
 */
export const HIRAGANA_MARKS_ROWS: Record<string, KanaSeed[]> = {
  ga: [
    { kana: 'が', romaji: 'ga', row: 'ga', order: 0 },
    { kana: 'ぎ', romaji: 'gi', row: 'ga', order: 1 },
    { kana: 'ぐ', romaji: 'gu', row: 'ga', order: 2 },
    { kana: 'げ', romaji: 'ge', row: 'ga', order: 3 },
    { kana: 'ご', romaji: 'go', row: 'ga', order: 4 },
  ],
  za: [
    { kana: 'ざ', romaji: 'za', row: 'za', order: 0 },
    { kana: 'じ', romaji: 'ji', row: 'za', order: 1 },
    { kana: 'ず', romaji: 'zu', row: 'za', order: 2 },
    { kana: 'ぜ', romaji: 'ze', row: 'za', order: 3 },
    { kana: 'ぞ', romaji: 'zo', row: 'za', order: 4 },
  ],
  da: [
    { kana: 'だ', romaji: 'da', row: 'da', order: 0 },
    // Same reading as じ. Rare in modern Japanese; kept because it is real.
    { kana: 'ぢ', romaji: 'ji', row: 'da', order: 1 },
    // Same reading as ず.
    { kana: 'づ', romaji: 'zu', row: 'da', order: 2 },
    { kana: 'で', romaji: 'de', row: 'da', order: 3 },
    { kana: 'ど', romaji: 'do', row: 'da', order: 4 },
  ],
  ba: [
    { kana: 'ば', romaji: 'ba', row: 'ba', order: 0 },
    { kana: 'び', romaji: 'bi', row: 'ba', order: 1 },
    { kana: 'ぶ', romaji: 'bu', row: 'ba', order: 2 },
    { kana: 'べ', romaji: 'be', row: 'ba', order: 3 },
    { kana: 'ぼ', romaji: 'bo', row: 'ba', order: 4 },
  ],
  pa: [
    { kana: 'ぱ', romaji: 'pa', row: 'pa', order: 0 },
    { kana: 'ぴ', romaji: 'pi', row: 'pa', order: 1 },
    { kana: 'ぷ', romaji: 'pu', row: 'pa', order: 2 },
    { kana: 'ぺ', romaji: 'pe', row: 'pa', order: 3 },
    { kana: 'ぽ', romaji: 'po', row: 'pa', order: 4 },
  ],
  kya: [
    { kana: 'きゃ', romaji: 'kya', row: 'kya', order: 0 },
    { kana: 'きゅ', romaji: 'kyu', row: 'kya', order: 1 },
    { kana: 'きょ', romaji: 'kyo', row: 'kya', order: 2 },
  ],
  // Hepburn: sha/shu/sho, never sya/syu/syo — し is already shi.
  sha: [
    { kana: 'しゃ', romaji: 'sha', row: 'sha', order: 0 },
    { kana: 'しゅ', romaji: 'shu', row: 'sha', order: 1 },
    { kana: 'しょ', romaji: 'sho', row: 'sha', order: 2 },
  ],
  // Likewise cha/chu/cho, following ち = chi.
  cha: [
    { kana: 'ちゃ', romaji: 'cha', row: 'cha', order: 0 },
    { kana: 'ちゅ', romaji: 'chu', row: 'cha', order: 1 },
    { kana: 'ちょ', romaji: 'cho', row: 'cha', order: 2 },
  ],
  nya: [
    { kana: 'にゃ', romaji: 'nya', row: 'nya', order: 0 },
    { kana: 'にゅ', romaji: 'nyu', row: 'nya', order: 1 },
    { kana: 'にょ', romaji: 'nyo', row: 'nya', order: 2 },
  ],
  hya: [
    { kana: 'ひゃ', romaji: 'hya', row: 'hya', order: 0 },
    { kana: 'ひゅ', romaji: 'hyu', row: 'hya', order: 1 },
    { kana: 'ひょ', romaji: 'hyo', row: 'hya', order: 2 },
  ],
  mya: [
    { kana: 'みゃ', romaji: 'mya', row: 'mya', order: 0 },
    { kana: 'みゅ', romaji: 'myu', row: 'mya', order: 1 },
    { kana: 'みょ', romaji: 'myo', row: 'mya', order: 2 },
  ],
  rya: [
    { kana: 'りゃ', romaji: 'rya', row: 'rya', order: 0 },
    { kana: 'りゅ', romaji: 'ryu', row: 'rya', order: 1 },
    { kana: 'りょ', romaji: 'ryo', row: 'rya', order: 2 },
  ],
  gya: [
    { kana: 'ぎゃ', romaji: 'gya', row: 'gya', order: 0 },
    { kana: 'ぎゅ', romaji: 'gyu', row: 'gya', order: 1 },
    { kana: 'ぎょ', romaji: 'gyo', row: 'gya', order: 2 },
  ],
  // ja/ju/jo, not jya — じ is ji, and the small ゃ does not add a y sound.
  ja: [
    { kana: 'じゃ', romaji: 'ja', row: 'ja', order: 0 },
    { kana: 'じゅ', romaji: 'ju', row: 'ja', order: 1 },
    { kana: 'じょ', romaji: 'jo', row: 'ja', order: 2 },
  ],
  bya: [
    { kana: 'びゃ', romaji: 'bya', row: 'bya', order: 0 },
    { kana: 'びゅ', romaji: 'byu', row: 'bya', order: 1 },
    { kana: 'びょ', romaji: 'byo', row: 'bya', order: 2 },
  ],
  pya: [
    { kana: 'ぴゃ', romaji: 'pya', row: 'pya', order: 0 },
    { kana: 'ぴゅ', romaji: 'pyu', row: 'pya', order: 1 },
    { kana: 'ぴょ', romaji: 'pyo', row: 'pya', order: 2 },
  ],
};

export const HIRAGANA_MARKS_UNIT = 'hiragana-marks';

/**
 * Six lessons, grouped by mechanism rather than by size. The dakuten rows come
 * in pairs because they are the same rule applied four times; the yōon lessons
 * are split so the voiced ones (ぎゃ, じゃ) arrive after both halves they are
 * built from.
 */
export const HIRAGANA_MARKS_LESSONS: LessonSeed[] = [
  {
    order: 0,
    title: 'Dakuten: が and ざ rows',
    rows: ['ga', 'za'],
    exerciseTypes: ['multipleChoice'],
  },
  {
    order: 1,
    title: 'Dakuten: だ and ば rows',
    rows: ['da', 'ba'],
    exerciseTypes: ['multipleChoice'],
  },
  {
    order: 2,
    title: 'Handakuten: the ぱ row',
    rows: ['pa'],
    exerciseTypes: ['multipleChoice'],
  },
  {
    order: 3,
    title: 'Yōon: きゃ, しゃ and ちゃ',
    rows: ['kya', 'sha', 'cha'],
    exerciseTypes: ['multipleChoice'],
  },
  {
    order: 4,
    title: 'Yōon: にゃ, ひゃ, みゃ and りゃ',
    rows: ['nya', 'hya', 'mya', 'rya'],
    exerciseTypes: ['multipleChoice'],
  },
  {
    order: 5,
    title: 'Yōon with dakuten: ぎゃ, じゃ, びゃ and ぴゃ',
    rows: ['gya', 'ja', 'bya', 'pya'],
    exerciseTypes: ['multipleChoice'],
  },
];

export const HIRAGANA_MARKS_PACK: KanaPack = {
  unit: HIRAGANA_MARKS_UNIT,
  script: 'hiragana',
  rows: HIRAGANA_MARKS_ROWS,
  lessons: HIRAGANA_MARKS_LESSONS,
};
