import { BLANK, GRAMMAR_GROUPS } from './grammar';
import { GRAMMAR_N4_GROUPS } from './grammar-n4';
import { HIRAGANA_ROWS } from './hiragana';
import { HIRAGANA_MARKS_ROWS } from './hiragana-marks';
import { KATAKANA_ROWS } from './katakana';
import { KATAKANA_MARKS_ROWS } from './katakana-marks';
import { MARKS_GROUPS } from './marks-words';
import { VOCAB_GROUPS } from './vocab';
import { VOCAB_EVERYDAY_GROUPS } from './vocab-everyday';
import { VOCAB_N4_GROUPS } from './vocab-n4';
import { VOCAB_N5_GROUPS } from './vocab-n5';

/**
 * Romaji is authored, not generated — so this is what stops it drifting from
 * the kana it is supposed to transcribe.
 *
 * The check transliterates each kana string with the seeded kana tables and
 * compares. Every mismatch must be a **listed** exception, which is how the
 * cases that matter stay visible instead of looking like typos:
 *
 *   - は as a topic marker is `wa`, not `ha`
 *   - を is an object marker is `o`, not `wo`
 *   - こんにちは ends in that same particle-derived は
 *
 * Those are exactly the cases a naive kana-table transliteration gets wrong,
 * and two of them are things this course explicitly teaches.
 */

/** Longest first, so きゃ matches before き. */
const KANA_TO_ROMAJI = [
  ...Object.values(HIRAGANA_ROWS).flat(),
  ...Object.values(KATAKANA_ROWS).flat(),
  ...Object.values(HIRAGANA_MARKS_ROWS).flat(),
  ...Object.values(KATAKANA_MARKS_ROWS).flat(),
]
  .map((c) => [c.kana, c.romaji] as const)
  .sort((a, b) => b[0].length - a[0].length);

/**
 * Marks that are not syllables and have no reading of their own. Tracked
 * separately rather than inside `KANA_TO_ROMAJI` because they emit nothing.
 */
const SOKUON = new Set(['っ', 'ッ']);
const CHOONPU = 'ー';

/**
 * Mechanical transliteration: no particle rules, no long-vowel rules. Returns
 * both the romaji and a record of where each chunk landed, so the mark
 * pass below can look back at the previous chunk's tail and the next chunk's
 * head.
 */
function transliterate(kana: string): string {
  /**
   * One chunk of the output. Empty for marks, but `mark` says which mark so
   * the post-pass knows whether to look back (chōonpu) or ahead (sokuon).
   */
  interface Chunk {
    text: string;
    mark?: 'sokuon' | 'choonpu';
  }

  const chunks: Chunk[] = [];
  let rest = kana;

  outer: while (rest.length > 0) {
    // Marks first: they consume one glyph and emit nothing. The post-pass
    // below folds them into adjacent chunks.
    if (SOKUON.has(rest[0])) {
      chunks.push({ text: '', mark: 'sokuon' });
      rest = rest.slice(1);
      continue;
    }
    if (rest[0] === CHOONPU) {
      chunks.push({ text: '', mark: 'choonpu' });
      rest = rest.slice(1);
      continue;
    }

    for (const [glyph, romaji] of KANA_TO_ROMAJI) {
      if (rest.startsWith(glyph)) {
        chunks.push({ text: romaji });
        rest = rest.slice(glyph.length);
        continue outer;
      }
    }
    // Punctuation and spaces are dropped; anything else is untranslatable and
    // would be a content bug, so it is surfaced rather than skipped.
    if (/[。、\s]/.test(rest[0])) {
      rest = rest.slice(1);
      continue;
    }
    chunks.push({ text: `«${rest[0]}»` });
    rest = rest.slice(1);
  }

  /**
   * Two passes over the chunk list:
   *
   *   - **sokuon** (っ/ッ) doubles the first consonant of the next chunk. If
   *     the next chunk starts with a vowel (or is itself a mark), the rule
   *     has no effect — the mark stays in place, which is how a content bug
   *     surfaces.
   *   - **chōonpu** (ー) doubles the last vowel of the previous chunk. If the
   *     previous chunk is empty (or is itself a mark), the mark again stays
   *     in place.
   *
   * A second pass would be redundant: each mark consumes one chunk and
   * affects exactly one adjacent chunk. Resolved as `text` on the chunk it
   * touches — the mark itself goes away once consumed.
   */
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk.mark) continue;

    if (chunk.mark === 'sokuon') {
      const next = chunks[i + 1];
      if (!next || next.text === '' || next.mark) continue;
      const match = /^([bcdfghjklmpqrstvwxyz])/.exec(next.text);
      if (match) {
        chunks[i + 1] = { text: match[1] + next.text };
      }
    } else {
      const prev = chunks[i - 1];
      if (!prev || prev.text === '' || prev.mark) continue;
      const match = /([aeiou])$/.exec(prev.text);
      if (match) {
        chunks[i - 1] = { text: prev.text + match[1] };
      }
    }
  }

  return chunks.map((c) => c.text).join('');
}

/** Authored romaji reduced to comparable form: no spaces or punctuation. */
function bare(romaji: string): string {
  return romaji.toLowerCase().replace(/[\s.,?!]/g, '');
}

const ALL_WORDS = [
  ...Object.values(VOCAB_GROUPS).flat(),
  ...Object.values(MARKS_GROUPS).flat(),
  ...Object.values(VOCAB_EVERYDAY_GROUPS).flat(),
  ...Object.values(VOCAB_N5_GROUPS).flat(),
  ...Object.values(VOCAB_N4_GROUPS).flat(),
];
const ALL_EXAMPLES = [
  ...Object.values(GRAMMAR_GROUPS).flat(),
  ...Object.values(GRAMMAR_N4_GROUPS).flat(),
].flatMap((point) => point.examples);

describe('every N5 item carries romaji', () => {
  it.each(ALL_WORDS.map((w) => [w.lemma, w.romaji] as const))(
    '%s has romaji (%s)',
    (_lemma, romaji) => {
      expect(romaji).toMatch(/^[a-z]+$/);
    },
  );

  it('every grammar example has romaji of the completed sentence', () => {
    for (const example of ALL_EXAMPLES) {
      expect(example.romaji).toMatch(/^[a-z .,?!]+$/);
      // It transcribes the *filled* sentence, so it must not carry the gap.
      expect(example.romaji).not.toContain(BLANK);
    }
  });
});

describe('romaji matches the kana it transcribes', () => {
  /**
   * Words whose romaji legitimately differs from a character-by-character
   * reading. One entry, and it is the single most famous case in the language.
   */
  const WORD_EXCEPTIONS: Record<string, string> = {
    // The final は is the topic particle fossilised into a greeting.
    こんにちは: 'konnichiwa — the trailing は is the particle, read "wa"',
  };

  it.each(ALL_WORDS.map((w) => [w.lemma, w.romaji] as const))(
    '%s → %s',
    (lemma, romaji) => {
      if (WORD_EXCEPTIONS[lemma]) return;
      expect(bare(romaji)).toBe(transliterate(lemma));
    },
  );

  it('lists every word that needed an exception', () => {
    const actuallyDiffer = ALL_WORDS.filter(
      (w) => bare(w.romaji) !== transliterate(w.lemma),
    ).map((w) => w.lemma);

    // If this fails, either a typo crept in or a real exception was added
    // without being written down. Both are worth stopping for.
    expect(actuallyDiffer.sort()).toEqual(Object.keys(WORD_EXCEPTIONS).sort());
  });

  /**
   * Sentences differ from a naive transliteration wherever a particle appears,
   * which is most of them. Rather than exempting them wholesale, the check
   * applies the two pronunciation rules the course teaches and *then* compares —
   * so a genuine typo still fails.
   */
  it.each(ALL_EXAMPLES.map((e) => [e.sentence, e.answer, e.romaji] as const))(
    '%s → %s',
    (sentence, answer, romaji) => {
      const completed = sentence.replace(BLANK, answer);

      const expected = transliterate(completed)
        // は as a particle: between words, never word-initial. Applying it to
        // the mechanical output is safe here because no word in the vocabulary
        // unit contains は except はな, はは and はい, none of which appear
        // mid-sentence in this unit.
        .replace(/ha/g, (match, offset: number) => (offset === 0 ? match : 'wa'))
        .replace(/wo/g, 'o');

      expect(bare(romaji)).toBe(expected);
    },
  );
});