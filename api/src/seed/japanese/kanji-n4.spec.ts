import { KANJI_GROUPS } from './kanji';
import { KANJI_N4_GROUPS, KANJI_N4_LESSONS } from './kanji-n4';
import { MARKS_GROUPS } from './marks-words';
import { VOCAB_GROUPS } from './vocab';
import { VOCAB_EVERYDAY_GROUPS } from './vocab-everyday';
import { VOCAB_N4_GROUPS } from './vocab-n4';
import { VOCAB_N5_GROUPS } from './vocab-n5';

const ALL_KANJI = Object.values(KANJI_N4_GROUPS).flat();

/** Every word taught by the time this unit is reached: all of N5 plus N4's own vocab. */
const SEEDED_WORDS = new Set(
  [
    ...Object.values(VOCAB_GROUPS).flat(),
    ...Object.values(MARKS_GROUPS).flat(),
    ...Object.values(VOCAB_EVERYDAY_GROUPS).flat(),
    ...Object.values(VOCAB_N5_GROUPS).flat(),
    ...Object.values(VOCAB_N4_GROUPS).flat(),
  ].map((word) => word.lemma),
);

const N5_KANJI_CHARS = new Set(Object.values(KANJI_GROUPS).flat().map((kanji) => kanji.char));

describe('every N4 kanji writes a word the course already taught', () => {
  it.each(ALL_KANJI.map((kanji) => [kanji.char, kanji.writes] as const))(
    '%s writes only seeded words (%s)',
    (_char, writes) => {
      const unseeded = writes.filter((word) => !SEEDED_WORDS.has(word));
      expect(unseeded).toEqual([]);
    },
  );

  it('gives every kanji at least one word, since the pairing is the whole design', () => {
    const orphans = ALL_KANJI.filter((kanji) => kanji.writes.length === 0);
    expect(orphans.map((kanji) => kanji.char)).toEqual([]);
  });
});

describe('the N4 kanji unit is internally consistent', () => {
  it('has no duplicate characters — the schema index would reject them', () => {
    const chars = ALL_KANJI.map((kanji) => kanji.char);
    expect(new Set(chars).size).toBe(chars.length);
  });

  /**
   * The cross-level version of the same rule `kanji.spec.ts` enforces within
   * N5: `char` is the natural key `upsertKanji` writes on, so re-adding an
   * N5 character here would silently overwrite it and re-tag it as N4.
   */
  it('claims no character the N5 unit already owns', () => {
    const collisions = ALL_KANJI.map((kanji) => kanji.char).filter((char) =>
      N5_KANJI_CHARS.has(char),
    );
    expect(collisions).toEqual([]);
  });

  it('has no duplicate meaning sets, which would cost a distractor', () => {
    const answers = ALL_KANJI.map((kanji) => kanji.meanings.join(', '));
    expect(new Set(answers).size).toBe(answers.length);
  });

  it('gives every kanji a meaning, or it cannot be quizzed at all', () => {
    for (const kanji of ALL_KANJI) {
      expect(kanji.meanings.length).toBeGreaterThan(0);
      for (const meaning of kanji.meanings) {
        expect(meaning.trim()).toBe(meaning);
        expect(meaning.length).toBeGreaterThan(0);
      }
    }
  });

  it('gives every kanji a plausible stroke count and a radical', () => {
    for (const kanji of ALL_KANJI) {
      expect(kanji.strokes).toBeGreaterThanOrEqual(1);
      // The highest stroke count in this unit is 競 at 20.
      expect(kanji.strokes).toBeLessThanOrEqual(20);
      expect(kanji.radical.length).toBeGreaterThan(0);
    }
  });

  it('writes on-yomi in katakana and kun-yomi in hiragana', () => {
    for (const kanji of ALL_KANJI) {
      for (const on of kanji.on) {
        expect(on).toMatch(/^[ァ-ヴー]+$/);
      }
      for (const kun of kanji.kun) {
        expect(kun).toMatch(/^[ぁ-んー.]+$/);
      }
    }
  });

  it('gives every kanji at least one reading', () => {
    for (const kanji of ALL_KANJI) {
      expect(kanji.on.length + kanji.kun.length).toBeGreaterThan(0);
    }
  });

  it('every lesson names a group that exists, and every group is used once', () => {
    const used = KANJI_N4_LESSONS.flatMap((lesson) => lesson.groups);

    for (const group of used) {
      expect(Object.keys(KANJI_N4_GROUPS)).toContain(group);
    }
    expect(new Set(used).size).toBe(used.length);
    expect(new Set(used)).toEqual(new Set(Object.keys(KANJI_N4_GROUPS)));
  });

  it('orders lessons contiguously from zero', () => {
    expect(KANJI_N4_LESSONS.map((lesson) => lesson.order)).toEqual(
      KANJI_N4_LESSONS.map((_, index) => index),
    );
  });

  it('gives every lesson enough kanji to fill an option set', () => {
    for (const lesson of KANJI_N4_LESSONS) {
      const count = lesson.groups.reduce(
        (total, group) => total + (KANJI_N4_GROUPS[group]?.length ?? 0),
        0,
      );
      expect(count).toBeGreaterThanOrEqual(4);
    }
  });

  it('is a substantial first N4 pack — 80 kanji or more', () => {
    expect(ALL_KANJI.length).toBeGreaterThanOrEqual(80);
  });
});
