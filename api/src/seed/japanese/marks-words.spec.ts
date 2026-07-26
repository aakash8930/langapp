import { MARKS_GROUPS } from './marks-words';

/**
 * The two marks-words units share a content table with the rest of the
 * vocab (it's all `VocabItem`s), but their constraints are different:
 * characters in the words here must include っ or ー (without those, the
 * unit teaches nothing), and the answers must be mechanistically
 * derivable from the kana by the extended transliterator.
 *
 * `romaji.spec.ts` then verifies every romaji against the transliterator —
 * so these checks only need to enforce shape.
 */

const ALL_WORDS = Object.values(MARKS_GROUPS).flat();

describe('the marks-words units are internally consistent', () => {
  it('have no duplicate lemmas inside a unit — schema index would reject them', () => {
    for (const words of Object.values(MARKS_GROUPS)) {
      const lemmas = words.map((w) => w.lemma);
      expect(new Set(lemmas).size).toBe(lemmas.length);
    }
  });

  it('every word actually teaches a mark (otherwise the unit is a vocabulary lesson in disguise)', () => {
    // っ (hiragana) or ッ (katakana) — sokuon, doubles the next consonant.
    // ー — chōonpu, lengthens the previous vowel.
    // Without one of those, the word is reachable from the existing vocab unit
    // and the marks-words lesson has nothing to add.
    for (const word of ALL_WORDS) {
      expect(word.lemma).toMatch(/[っッー]/);
    }
  });

  it('reading equals lemma (kana-only spelling, like the rest of N5)', () => {
    for (const word of ALL_WORDS) {
      expect(word.reading).toBe(word.lemma);
    }
  });
});