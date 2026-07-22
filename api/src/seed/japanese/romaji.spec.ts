import { BLANK, GRAMMAR_GROUPS } from './grammar';
import { HIRAGANA_ROWS } from './hiragana';
import { HIRAGANA_MARKS_ROWS } from './hiragana-marks';
import { VOCAB_GROUPS } from './vocab';

/**
 * Romaji is authored, not generated — so this is what stops it drifting from
 * the kana it is supposed to transcribe.
 *
 * The check transliterates each kana string with the seeded kana tables and
 * compares. Every mismatch must be a **listed** exception, which is how the
 * cases that matter stay visible instead of looking like typos:
 *
 *   - は as a topic marker is `wa`, not `ha`
 *   - を as an object marker is `o`, not `wo`
 *   - こんにちは ends in that same particle-derived は
 *
 * Those are exactly the cases a naive kana-table transliteration gets wrong,
 * and two of them are things this course explicitly teaches.
 */

/** Longest first, so きゃ matches before き. */
const KANA_TO_ROMAJI = [
  ...Object.values(HIRAGANA_ROWS).flat(),
  ...Object.values(HIRAGANA_MARKS_ROWS).flat(),
]
  .map((c) => [c.kana, c.romaji] as const)
  .sort((a, b) => b[0].length - a[0].length);

/** Mechanical transliteration: no particle rules, no long-vowel rules. */
function transliterate(kana: string): string {
  let rest = kana;
  let out = '';

  outer: while (rest.length > 0) {
    for (const [glyph, romaji] of KANA_TO_ROMAJI) {
      if (rest.startsWith(glyph)) {
        out += romaji;
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
    out += `«${rest[0]}»`;
    rest = rest.slice(1);
  }

  return out;
}

/** Authored romaji reduced to comparable form: no spaces or punctuation. */
function bare(romaji: string): string {
  return romaji.toLowerCase().replace(/[\s.,?!]/g, '');
}

const ALL_WORDS = Object.values(VOCAB_GROUPS).flat();
const ALL_EXAMPLES = Object.values(GRAMMAR_GROUPS)
  .flat()
  .flatMap((point) => point.examples);

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
