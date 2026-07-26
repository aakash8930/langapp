import { KANJI_GROUPS, KANJI_LESSONS } from './kanji';
import { MARKS_GROUPS } from './marks-words';
import { VOCAB_GROUPS } from './vocab';
import { VOCAB_EVERYDAY_GROUPS } from './vocab-everyday';

const ALL_KANJI = Object.values(KANJI_GROUPS).flat();

/** Every word the course actually teaches, across all three vocabulary sources. */
const SEEDED_WORDS = new Set(
  [
    ...Object.values(VOCAB_GROUPS).flat(),
    ...Object.values(MARKS_GROUPS).flat(),
    ...Object.values(VOCAB_EVERYDAY_GROUPS).flat(),
  ].map((word) => word.lemma),
);

describe('every kanji writes a word the course already taught', () => {
  /**
   * The point of the unit, enforced rather than trusted.
   *
   * A kanji whose `writes` list names a word that is not seeded is teaching a
   * glyph for something the learner has never met — which is exactly the
   * memorisation slog this unit is placed last to avoid. This caught たべもの
   * ("food") on 物 the first time it ran: a plausible word, and not one the
   * course teaches. くだもの is.
   */
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

describe('the kanji unit is internally consistent', () => {
  it('has no duplicate characters — the schema index would reject them', () => {
    const chars = ALL_KANJI.map((kanji) => kanji.char);
    expect(new Set(chars).size).toBe(chars.length);
  });

  /**
   * Meanings are joined into the quiz answer, and distractors are deduped by
   * answer text — so two kanji meaning the same thing silently cost an option
   * rather than making a question unanswerable. Same rule as the vocabulary
   * units, same reason.
   */
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

  /**
   * `strokes` is `required, min: 1` and `radical` is `required` on the schema, so
   * a missing one is a seed-time failure rather than a quiet gap. Checked here so
   * it fails in the suite instead of against a live Mongo.
   */
  it('gives every kanji a plausible stroke count and a radical', () => {
    for (const kanji of ALL_KANJI) {
      expect(kanji.strokes).toBeGreaterThanOrEqual(1);
      // The highest stroke count in this unit is 顔 at 18. A number far above
      // that is a typo, not a character.
      expect(kanji.strokes).toBeLessThanOrEqual(20);
      expect(kanji.radical.length).toBeGreaterThan(0);
    }
  });

  /**
   * On-yomi is katakana and kun-yomi hiragana — the standard convention, and the
   * only thing that lets a learner tell which kind of reading they are looking at
   * when both are listed side by side.
   *
   * Kun readings may carry the okurigana dot (た.べる), which is why '.' is
   * allowed in that pattern and not in the on-yomi one.
   */
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
    const used = KANJI_LESSONS.flatMap((lesson) => lesson.groups);

    for (const group of used) {
      expect(Object.keys(KANJI_GROUPS)).toContain(group);
    }
    expect(new Set(used).size).toBe(used.length);
    expect(new Set(used)).toEqual(new Set(Object.keys(KANJI_GROUPS)));
  });

  it('orders lessons contiguously from zero', () => {
    expect(KANJI_LESSONS.map((lesson) => lesson.order)).toEqual(
      KANJI_LESSONS.map((_, index) => index),
    );
  });

  /** Four options per question means four distinct items in the unit pool. */
  it('gives every lesson enough kanji to fill an option set', () => {
    for (const lesson of KANJI_LESSONS) {
      const count = lesson.groups.reduce(
        (total, group) => total + (KANJI_GROUPS[group]?.length ?? 0),
        0,
      );
      expect(count).toBeGreaterThanOrEqual(4);
    }
  });

  it('is the unit it was meant to be — around 100 kanji', () => {
    expect(ALL_KANJI.length).toBeGreaterThanOrEqual(100);
  });
});
