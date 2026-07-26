import type { VocabSeed, VocabLessonSeed } from './vocab';

/**
 * Words that exist to teach the two marks the marks units don't:
 *
 * - **っ** (sokuon) — doubles the consonant that follows it. がっこう is
 *   `gakkou`, not `gakou`: the `k` is the unvoiced version of a `g`, held
 *   briefly before the next vowel takes over. There is no syllable to quiz
 *   here, so a multiple-choice "which romaji matches this character?" has
 *   nothing to ask.
 * - **ー** (chōonpu) — lengthens the vowel of the syllable that precedes it.
 *   コーヒ is `koohii`. Same shape: nothing to ask on a single mark.
 *
 * A typing exercise — show the word, the learner types the romaji — is the
 * only shape that *forces* the doubled consonant or vowel to be produced.
 * Multiple-choice on a four-reading option set would have a learner choose
 * between `gakkou` and `gakou`, and the four options can be made consistent
 * enough to guess without knowing.
 *
 * ## Why each word is here
 *
 * Each lesson is six words and exercises in `multipleChoice` (kana means
 * ×reading) cannot say anything about っ and ー — this unit therefore ships
 * with `exerciseTypes: ['wordReading']`, a new shape added in T1.1.
 *
 * Hiragana is heavy on っ (since ー is rare in native words) and katakana
 * is mixed (both marks are everyday in loanwords). こーひー and コーヒー
 * show up in both scripts as the standard hiragana-vs-katakana contrast;
 * the schema keys on `lemma`, so the two are distinct content docs.
 */
export const MARKS_GROUPS: Record<string, VocabSeed[]> = {
  hiragana: [
    { lemma: 'がっこう', reading: 'がっこう', romaji: 'gakkou', gloss: 'school', pos: 'noun' },
    { lemma: 'きって', reading: 'きって', romaji: 'kitte', gloss: 'stamp, post office', pos: 'noun' },
    { lemma: 'ずっと', reading: 'ずっと', romaji: 'zutto', gloss: 'continuously', pos: 'adverb' },
    { lemma: 'きっと', reading: 'きっと', romaji: 'kitto', gloss: 'surely', pos: 'adverb' },
    { lemma: 'いっしょ', reading: 'いっしょ', romaji: 'issho', gloss: 'together', pos: 'adverb' },
    { lemma: 'こーひー', reading: 'こーひー', romaji: 'koohii', gloss: 'coffee', pos: 'noun' },
  ],
  katakana: [
    { lemma: 'コーヒー', reading: 'コーヒー', romaji: 'koohii', gloss: 'coffee', pos: 'noun' },
    { lemma: 'テーブル', reading: 'テーブル', romaji: 'teeburu', gloss: 'table', pos: 'noun' },
    { lemma: 'ビール', reading: 'ビール', romaji: 'biiru', gloss: 'beer', pos: 'noun' },
    { lemma: 'ベッド', reading: 'ベッド', romaji: 'beddo', gloss: 'bed', pos: 'noun' },
    { lemma: 'カップ', reading: 'カップ', romaji: 'kappu', gloss: 'cup', pos: 'noun' },
    { lemma: 'スープ', reading: 'スープ', romaji: 'suupu', gloss: 'soup', pos: 'noun' },
  ],
};

/**
 * Two units, one lesson each. The chain — and therefore the gating — is:
 *
 *   katakana-marks (last lesson) →
 *   hiragana-marks-extra (one lesson) →
 *   katakana-marks-extra (one lesson) →
 *   grammar
 *
 * Order matches the script order: the hiragana unit first, so a learner who
 * pauses after one of them does so at a natural kana-script boundary.
 */
export const HIRAGANA_MARKS_EXTRA_UNIT = 'hiragana-marks-extra';

export const HIRAGANA_MARKS_EXTRA_LESSONS: VocabLessonSeed[] = [
  {
    order: 0,
    title: 'Hiragana words: っ and ー',
    groups: ['hiragana'],
    exerciseTypes: ['wordReading'],
  },
];

export const KATAKANA_MARKS_EXTRA_UNIT = 'katakana-marks-extra';

export const KATAKANA_MARKS_EXTRA_LESSONS: VocabLessonSeed[] = [
  {
    order: 0,
    title: 'Katakana words: ッ and ー',
    groups: ['katakana'],
    exerciseTypes: ['wordReading'],
  },
];