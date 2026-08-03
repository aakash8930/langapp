/**
 * Phase 0 — Data foundation helpers.
 *
 * "Decompose a Japanese word into the kana characters it is made of" is the
 * primitive behind:
 *   - the `constituentKana` backfill on `VocabItem` (the migration),
 *   - the constrained content filter that forbids any character the user
 *     has not been taught (§Phase 1 #5), and
 *   - the bare reading screen, which must show only words whose every kana
 *     is in `User.knownKana` (Phase 0 #4).
 *
 * It has to live in one place because three callers depend on the *same*
 * rule (a learner is taught `か`, not `が` — dakuten belongs to a later
 * lesson); divergence between the migration and the filter is exactly the
 * drift class that "shared source of truth" is supposed to prevent.
 *
 * Design notes
 * ------------
 *  - The helper iterates over **code points**, not UTF-16 units. Some kana
 *    supplementary plane characters (rare CJK ideographs) decode to two
 *    `string.charCodeAt(i) === charCode` indices in JavaScript; iterating
 *    over `for…of` avoids splitting those.
 *  - Kanji and everything outside the kana ranges are **filtered out**,
 *    not preserved as-is. Phase 0 only deals with kana compositions; mixed
 *    kanji/kana words are deferred to OPEN-ITEMS P0-1. A word made entirely
 *    of kanji decomposes to `[]`, which is the correct answer for "what
 *    kana does this word use": none.
 *  - The result preserves order and is **de-duplicated by occurrence** via
 *    a `Set`, with the order kept by inserting at the `Set` and reading it
 *    back. "Distinct characters in composition order" is what callers want
 *    — the filter's `$subset` semantics are per-character, not per-occurrence.
 *  - The return is typed as `readonly string[]` so callers cannot mutate
 *    a result that will be persisted to Mongo. Doing that pass-by-mutate
 *    once will silently corrupt a `constituentKana` array and waste a
 *    whole afternoon.
 */

/**
 * Lower bound of the hiragana block, inclusive.
 * U+3040 — the "぀" iteration mark is the first assigned hiragana.
 * We start one code point later so the iteration marks fall outside.
 */
const HIRAGANA_LO = 0x3041; // ぁ
/** Upper bound of the hiragana block, inclusive. U+309F = the last hiragana. */
const HIRAGANA_HI = 0x309f;

/** Lower bound of the katakana block, inclusive. U+30A0 is not assigned; we start at the first assigned. */
const KATAKANA_LO = 0x30a1; // ァ
/** Upper bound of the katakana block, inclusive. U+30FF is the last. */
const KATAKANA_HI = 0x30ff;

/** `ー` — katakana prolonged-sound mark. Iterated, so it has to be its own case. */
const PROLONGED_MARK = '\u30fc';

/** Half-width katakana (the ｱ range). Not in the content pack, deliberately rejected. */
const HALF_KATAKANA_LO = 0xff65;
const HALF_KATAKANA_HI = 0xff9f;

function isHiragana(codePoint: number): boolean {
  return codePoint >= HIRAGANA_LO && codePoint <= HIRAGANA_HI;
}

function isKatakana(codePoint: number): boolean {
  if (codePoint === PROLONGED_MARK.charCodeAt(0)) {
    return true;
  }
  if (codePoint >= KATAKANA_LO && codePoint <= KATAKANA_HI) {
    return true;
  }
  // Half-width katakana — reject by design. The Japanese pack uses full-width.
  if (codePoint >= HALF_KATAKANA_LO && codePoint <= HALF_KATAKANA_HI) {
    return true;
  }
  return false;
}

/**
 * Walk a string by code-point, return each character that is hiragana,
 * katakana, or the prolonged-sound mark, in composition order, de-duplicated
 * by first occurrence.
 *
 * Non-kana characters (kanji, latin, punctuation, whitespace) are skipped
 * silently. So `こんばんは` becomes `['こ', 'ん', 'ば', 'は']` and
 * `食べる` becomes `['食', 'べ', 'る']` minus kanji, i.e.
 * `['べ', 'る']` — which is fine for the Phase 0 filter because
 * a word with kanji returns an empty-ish "incomplete" signature and the
 * filter already needs to handle that case for the kanji-era content.
 *
 * Read-only result, by design (see header).
 */
export function decomposeIntoKana(input: string): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  // `for…of` over a string iterates by code point, not by UTF-16 unit, so
  // astral-plane characters don't get split.
  for (const ch of input) {
    // Code-point length of a single iterable character is 1 by construction.
    const code = ch.codePointAt(0);
    if (code === undefined) {
      continue;
    }
    if (!isHiragana(code) && !isKatakana(code)) {
      continue;
    }
    if (seen.has(ch)) {
      continue;
    }
    seen.add(ch);
    out.push(ch);
  }

  return out;
}
