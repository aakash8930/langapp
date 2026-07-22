import { HIRAGANA_ROWS } from './hiragana';
import { HIRAGANA_MARKS_PACK } from './hiragana-marks';
import type { KanaPack } from './kana-pack';
import { KATAKANA_ROWS } from './katakana';
import { KATAKANA_MARKS_PACK } from './katakana-marks';

const PACKS = [
  ['hiragana', HIRAGANA_MARKS_PACK],
  ['katakana', KATAKANA_MARKS_PACK],
] as const;

function charactersOf(pack: KanaPack) {
  return Object.values(pack.rows).flat();
}

/** Small ゃゅょ and their katakana counterparts — the second half of a yōon. */
const SMALL_Y = new Set(['ゃ', 'ゅ', 'ょ', 'ャ', 'ュ', 'ョ']);

describe.each(PACKS)('%s marks pack', (_name, pack) => {
  const characters = charactersOf(pack);

  it('holds 58 syllables: 20 dakuten, 5 handakuten, 33 yōon', () => {
    expect(characters).toHaveLength(58);
    expect(characters.filter((c) => c.kana.length === 1)).toHaveLength(25);
    expect(characters.filter((c) => c.kana.length === 2)).toHaveLength(33);
  });

  it('writes every yōon as a base character plus a small ゃゅょ', () => {
    for (const character of characters.filter((c) => c.kana.length === 2)) {
      const [base, small] = [...character.kana];
      // The full-size や in きや would be two morae, a different word.
      expect(SMALL_Y.has(small)).toBe(true);
      expect(SMALL_Y.has(base)).toBe(false);
    }
  });

  it('uses lowercase latin romaji only', () => {
    for (const character of characters) {
      expect(character.romaji).toMatch(/^[a-z]+$/);
    }
  });

  it('has no duplicate characters — the schema index would reject them', () => {
    const kana = characters.map((c) => c.kana);
    expect(new Set(kana).size).toBe(kana.length);
  });

  it('teaches nothing the base table already taught', () => {
    const base = new Set(
      [...Object.values(HIRAGANA_ROWS), ...Object.values(KATAKANA_ROWS)].flat().map((c) => c.kana),
    );

    for (const character of characters) {
      expect(base.has(character.kana)).toBe(false);
    }
  });

  it('every lesson names rows that exist, and every row is taught exactly once', () => {
    const used = pack.lessons.flatMap((lesson) => lesson.rows);

    for (const row of used) {
      expect(Object.keys(pack.rows)).toContain(row);
    }
    expect(new Set(used).size).toBe(used.length);
    expect(new Set(used)).toEqual(new Set(Object.keys(pack.rows)));
  });

  it('orders lessons contiguously from zero', () => {
    expect(pack.lessons.map((lesson) => lesson.order)).toEqual(
      pack.lessons.map((_, index) => index),
    );
  });
});

/**
 * The two tables are the same syllabary in two scripts. Comparing them by
 * romaji is the only practical way to catch one mistyped or missing character
 * out of 116 — an error that is invisible by inspection and would ship a lesson
 * teaching the wrong sound.
 */
describe('the two marks packs mirror each other', () => {
  it('teaches the same romaji, in the same row order', () => {
    const hiragana = charactersOf(HIRAGANA_MARKS_PACK).map((c) => c.romaji);
    const katakana = charactersOf(KATAKANA_MARKS_PACK).map((c) => c.romaji);

    expect(katakana).toEqual(hiragana);
  });

  it('splits into lessons identically', () => {
    expect(KATAKANA_MARKS_PACK.lessons.map((l) => l.rows)).toEqual(
      HIRAGANA_MARKS_PACK.lessons.map((l) => l.rows),
    );
  });

  it('keeps the two known romaji collisions and no others', () => {
    const romaji = charactersOf(HIRAGANA_MARKS_PACK).map((c) => c.romaji);
    const duplicated = romaji.filter((value, index) => romaji.indexOf(value) !== index);

    // ぢ repeats じ's "ji"; づ repeats ず's "zu". Anything else is a typo.
    expect(duplicated.sort()).toEqual(['ji', 'zu']);
  });
});
