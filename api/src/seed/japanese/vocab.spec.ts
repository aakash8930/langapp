import { HIRAGANA_ROWS } from './hiragana';
import { KATAKANA_ROWS } from './katakana';
import { VOCAB_GROUPS, VOCAB_LESSONS } from './vocab';

/** Every character the two kana units actually teach. */
const TAUGHT = new Set(
  [...Object.values(HIRAGANA_ROWS), ...Object.values(KATAKANA_ROWS)]
    .flat()
    .map((character) => character.kana),
);

const ALL_WORDS = Object.values(VOCAB_GROUPS).flat();

describe('the first vocabulary unit is readable with only the kana that precede it', () => {
  /**
   * The rule that picked the word list, enforced rather than trusted.
   *
   * A word here containing だ or ゃ or ー is not a typo, it is a lesson whose
   * first card cannot be read by the person who just unlocked it. Failing the
   * build is the only way that stays true as words are added.
   */
  it.each(ALL_WORDS.map((word) => [word.lemma, word.gloss] as const))(
    '%s (%s) uses only taught characters',
    (lemma) => {
      const untaught = [...lemma].filter((character) => !TAUGHT.has(character));
      expect(untaught).toEqual([]);
    },
  );

  it('reading matches lemma, because this unit is written in kana', () => {
    for (const word of ALL_WORDS) {
      expect(word.reading).toBe(word.lemma);
    }
  });
});

describe('the vocabulary unit is internally consistent', () => {
  it('has no duplicate lemmas — the schema index would reject them at seed time', () => {
    const lemmas = ALL_WORDS.map((word) => word.lemma);
    expect(new Set(lemmas).size).toBe(lemmas.length);
  });

  it('has no duplicate glosses, which would make a question unanswerable', () => {
    // Two options reading "to eat" cannot be told apart, and distractors are
    // drawn from the whole unit — so the collision does not have to be inside
    // one lesson to bite.
    const glosses = ALL_WORDS.map((word) => word.gloss);
    expect(new Set(glosses).size).toBe(glosses.length);
  });

  it('every lesson names a group that exists, and every group is used once', () => {
    const used = VOCAB_LESSONS.flatMap((lesson) => lesson.groups);

    for (const group of used) {
      expect(Object.keys(VOCAB_GROUPS)).toContain(group);
    }
    expect(new Set(used).size).toBe(used.length);
    expect(new Set(used)).toEqual(new Set(Object.keys(VOCAB_GROUPS)));
  });

  it('orders lessons contiguously from zero', () => {
    expect(VOCAB_LESSONS.map((lesson) => lesson.order)).toEqual(
      VOCAB_LESSONS.map((_, index) => index),
    );
  });

  it('uses direct decoding checks, never an English recognition word bank', () => {
    expect(VOCAB_LESSONS.every((lesson) => lesson.exerciseTypes.includes('wordReading'))).toBe(true);
  });
});
