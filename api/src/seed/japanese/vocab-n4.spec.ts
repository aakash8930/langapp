import { MARKS_GROUPS } from './marks-words';
import { VOCAB_GROUPS } from './vocab';
import { VOCAB_EVERYDAY_GROUPS } from './vocab-everyday';
import { VOCAB_N4_GROUPS, VOCAB_N4_LESSONS } from './vocab-n4';
import { VOCAB_N5_GROUPS } from './vocab-n5';

const ALL_WORDS = Object.values(VOCAB_N4_GROUPS).flat();

/** Every lemma the N5 packs already own. `lemma` is the upsert key. */
const N5_LEMMAS = new Set(
  [
    ...Object.values(VOCAB_GROUPS).flat(),
    ...Object.values(MARKS_GROUPS).flat(),
    ...Object.values(VOCAB_EVERYDAY_GROUPS).flat(),
    ...Object.values(VOCAB_N5_GROUPS).flat(),
  ].map((word) => word.lemma),
);

describe('the first N4 vocabulary unit is internally consistent', () => {
  it('has no duplicate lemmas — the schema index would reject them', () => {
    const lemmas = ALL_WORDS.map((word) => word.lemma);
    expect(new Set(lemmas).size).toBe(lemmas.length);
  });

  /**
   * The cross-level version of the same rule. `lemma` is the natural key
   * `upsertVocab` writes on, so reusing an N5 lemma here would silently merge
   * into (and re-tag as N4) a word the earlier packs already own.
   */
  it('claims no lemma an N5 unit already owns', () => {
    const collisions = ALL_WORDS.map((word) => word.lemma).filter((lemma) =>
      N5_LEMMAS.has(lemma),
    );
    expect(collisions).toEqual([]);
  });

  it('reading matches lemma, because this unit is still written in kana', () => {
    for (const word of ALL_WORDS) {
      expect(word.reading).toBe(word.lemma);
    }
  });

  it('has no duplicate glosses, which would cost a distractor', () => {
    const glosses = ALL_WORDS.map((word) => word.gloss);
    expect(new Set(glosses).size).toBe(glosses.length);
  });

  it('gives every word a jlpt-appropriate part of speech', () => {
    for (const word of ALL_WORDS) {
      expect(word.pos.length).toBeGreaterThan(0);
    }
  });

  it('every lesson names a group that exists, and every group is used once', () => {
    const used = VOCAB_N4_LESSONS.flatMap((lesson) => lesson.groups);

    for (const group of used) {
      expect(Object.keys(VOCAB_N4_GROUPS)).toContain(group);
    }
    expect(new Set(used).size).toBe(used.length);
    expect(new Set(used)).toEqual(new Set(Object.keys(VOCAB_N4_GROUPS)));
  });

  it('orders lessons contiguously from zero', () => {
    expect(VOCAB_N4_LESSONS.map((lesson) => lesson.order)).toEqual(
      VOCAB_N4_LESSONS.map((_, index) => index),
    );
  });

  it('gives every lesson enough words to fill an option set', () => {
    for (const lesson of VOCAB_N4_LESSONS) {
      const count = lesson.groups.reduce(
        (total, group) => total + (VOCAB_N4_GROUPS[group]?.length ?? 0),
        0,
      );
      expect(count).toBeGreaterThanOrEqual(4);
    }
  });

  it('is a substantial first N4 pack — 100 words or more', () => {
    expect(ALL_WORDS.length).toBeGreaterThanOrEqual(100);
  });
});
