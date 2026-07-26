import { HIRAGANA_ROWS } from './hiragana';
import { HIRAGANA_MARKS_ROWS } from './hiragana-marks';
import { KATAKANA_ROWS } from './katakana';
import { KATAKANA_MARKS_ROWS } from './katakana-marks';
import { MARKS_GROUPS } from './marks-words';
import { VOCAB_GROUPS } from './vocab';
import { VOCAB_EVERYDAY_GROUPS } from './vocab-everyday';
import { VOCAB_N5_GROUPS, VOCAB_N5_LESSONS } from './vocab-n5';

/**
 * Every character taught by the four kana units that precede this one, plus the
 * two marks the marks-words units teach.
 *
 * Yōon are stored as two-glyph strings ('きゃ'), so the set is built by
 * splitting each taught syllable into characters — teaching きゃ does teach both
 * き and ゃ. That is the difference between this set and `vocab.spec.ts`'s,
 * where no word contains a small kana at all.
 */
const TAUGHT = new Set(
  [
    ...Object.values(HIRAGANA_ROWS),
    ...Object.values(KATAKANA_ROWS),
    ...Object.values(HIRAGANA_MARKS_ROWS),
    ...Object.values(KATAKANA_MARKS_ROWS),
  ]
    .flat()
    .flatMap((character) => [...character.kana])
    // っ/ッ (sokuon) and ー (chōonpu) are taught by the two marks-words units,
    // which sit immediately before this one in the chain.
    .concat(['っ', 'ッ', 'ー']),
);

const ALL_WORDS = Object.values(VOCAB_N5_GROUPS).flat();

/** The lemmas already claimed by earlier units. `lemma` is the upsert key. */
const EARLIER_LEMMAS = new Set(
  [
    ...Object.values(VOCAB_GROUPS).flat(),
    ...Object.values(MARKS_GROUPS).flat(),
    ...Object.values(VOCAB_EVERYDAY_GROUPS).flat(),
  ].map((word) => word.lemma),
);

describe('the third vocabulary unit is readable with the kana that precede it', () => {
  it.each(ALL_WORDS.map((word) => [word.lemma, word.gloss] as const))(
    '%s (%s) uses only taught characters',
    (lemma) => {
      const untaught = [...lemma].filter((character) => !TAUGHT.has(character));
      expect(untaught).toEqual([]);
    },
  );

  /**
   * The small vowels are the trap this test exists for. ぁぃぅぇぉ / ァィゥェォ
   * and ヴ are not in the gojūon and no unit teaches them, so フォーク and
   * パーティー look like ordinary beginner loanwords and are not spellable here.
   * Stated separately from the check above so the failure message says *why*.
   */
  it('contains no small vowel or ヴ, which no unit teaches', () => {
    const forbidden = /[ぁぃぅぇぉァィゥェォヴヮヵヶ]/;
    const offenders = ALL_WORDS.filter((word) => forbidden.test(word.lemma));
    expect(offenders.map((word) => word.lemma)).toEqual([]);
  });

  /**
   * っ + ち would transliterate to `ccha` by the doubling rule in
   * `romaji.spec.ts`, but Hepburn writes まっちゃ as `matcha`. Rather than carry
   * an exception, the unit avoids the sequence — this pins that choice so the
   * next person adding a word finds out here rather than in the romaji spec.
   */
  it('avoids っ before ち, where the doubling rule and Hepburn disagree', () => {
    const offenders = ALL_WORDS.filter((word) => /[っッ][ちチ]/.test(word.lemma));
    expect(offenders.map((word) => word.lemma)).toEqual([]);
  });

  it('reading matches lemma, because this unit is still written in kana', () => {
    for (const word of ALL_WORDS) {
      expect(word.reading).toBe(word.lemma);
    }
  });
});

describe('the third vocabulary unit is internally consistent', () => {
  it('has no duplicate lemmas — the schema index would reject them', () => {
    const lemmas = ALL_WORDS.map((word) => word.lemma);
    expect(new Set(lemmas).size).toBe(lemmas.length);
  });

  /**
   * The cross-unit version of the same rule, and the one that actually caught
   * something: `lemma` is the natural key `upsertVocab` writes on, so reusing
   * はな for "nose" would silently merge into the first unit's はな ("flower")
   * and rewrite its gloss rather than adding a word.
   */
  it('claims no lemma an earlier unit already owns', () => {
    const collisions = ALL_WORDS.map((word) => word.lemma).filter((lemma) =>
      EARLIER_LEMMAS.has(lemma),
    );
    expect(collisions).toEqual([]);
  });

  it('has no duplicate glosses, which would cost a distractor', () => {
    // Distractors are deduped by answer text across the whole unit pool, so a
    // repeated gloss does not make a question unanswerable — it quietly drops
    // an option and makes the quiz easier. Same reason as the first unit.
    const glosses = ALL_WORDS.map((word) => word.gloss);
    expect(new Set(glosses).size).toBe(glosses.length);
  });

  it('every lesson names a group that exists, and every group is used once', () => {
    const used = VOCAB_N5_LESSONS.flatMap((lesson) => lesson.groups);

    for (const group of used) {
      expect(Object.keys(VOCAB_N5_GROUPS)).toContain(group);
    }
    expect(new Set(used).size).toBe(used.length);
    expect(new Set(used)).toEqual(new Set(Object.keys(VOCAB_N5_GROUPS)));
  });

  it('orders lessons contiguously from zero', () => {
    expect(VOCAB_N5_LESSONS.map((lesson) => lesson.order)).toEqual(
      VOCAB_N5_LESSONS.map((_, index) => index),
    );
  });

  /**
   * Every lesson needs at least four words or `multipleChoice` cannot fill four
   * options from the unit pool — see OPEN-ITEMS #10c, where a thin unit degrades
   * to a two-option quiz silently rather than erroring.
   */
  it('gives every lesson enough words to fill an option set', () => {
    for (const lesson of VOCAB_N5_LESSONS) {
      const count = lesson.groups.reduce(
        (total, group) => total + (VOCAB_N5_GROUPS[group]?.length ?? 0),
        0,
      );
      expect(count).toBeGreaterThanOrEqual(4);
    }
  });

  it('is the substantial unit it was meant to be — 500 words or more', () => {
    expect(ALL_WORDS.length).toBeGreaterThanOrEqual(500);
  });
});
