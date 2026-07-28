import type { KanaPack } from './kana-pack';

/**
 * Concepts and contrasts for the knowledge graph (ADR-005 / §5.3).
 *
 * Two different kinds of data live here, and the difference matters:
 *
 * - **Row concepts are derived.** `rowConcepts` reads the kana packs, so あ-row
 *   membership is whatever the pack says and cannot drift from it.
 * - **Contrasts are authored.** No table encodes that シ and ツ look alike, and
 *   は-as-particle vs は-as-syllable is not a property of the character at all.
 *   This is the same reasoning that makes romaji authored rather than
 *   transliterated: mechanical derivation is wrong exactly where it matters.
 *
 * Because it is authored, it is **gated**: `concepts.spec.ts` resolves every
 * reference against the seed packs and fails on anything the course does not
 * teach. That is not a formality — it is what stopped §5.3's own example.
 *
 * ## The が/は contrast §5.3 asks for is deliberately absent
 *
 * §5.3 names "が vs は" as a target. The course teaches **は as a topic marker**
 * and does not teach が as a subject marker at all — が exists only as a kana in
 * the dakuten unit. Authoring that pair would put a claim in the graph about a
 * distinction no lesson draws, and the spec rejects it. It belongs here the day a
 * が grammar point does.
 */

export type ContrastRef =
  | { kind: 'kana'; script: 'hiragana' | 'katakana'; kana: string }
  | { kind: 'grammar'; title: string };

export interface ContrastSeed {
  a: ContrastRef;
  b: ContrastRef;
  /**
   * Why a learner confuses these two. Not shown anywhere yet — it is the
   * justification for the edge existing, kept next to the edge so a later reader
   * can judge the pair rather than trust it.
   */
  note: string;
}

const hiragana = (kana: string): ContrastRef => ({ kind: 'kana', script: 'hiragana', kana });
const katakana = (kana: string): ContrastRef => ({ kind: 'kana', script: 'katakana', kana });
const grammar = (title: string): ContrastRef => ({ kind: 'grammar', title });

/**
 * Hiragana that differ by one stroke or one loop. These are shape confusions, so
 * they are all *within* the script — a learner mixing up ね and れ is not making
 * a sound error.
 */
const HIRAGANA_SHAPE_CONTRASTS: ContrastSeed[] = [
  { a: hiragana('ね'), b: hiragana('れ'), note: 'Same left stroke and vertical; ね closes into a loop, れ does not.' },
  { a: hiragana('ね'), b: hiragana('わ'), note: 'Same frame as ね with a different right side; わ has no loop.' },
  { a: hiragana('れ'), b: hiragana('わ'), note: 'Differ only in the final stroke — れ kicks out, わ curves in.' },
  { a: hiragana('る'), b: hiragana('ろ'), note: 'Identical path; る ends in a closed loop and ろ stops short.' },
  { a: hiragana('さ'), b: hiragana('き'), note: 'き is さ with one extra horizontal stroke.' },
  { a: hiragana('は'), b: hiragana('ほ'), note: 'ほ is は with an extra horizontal stroke at the top.' },
  { a: hiragana('ぬ'), b: hiragana('め'), note: 'Same two strokes; ぬ finishes with a loop, め does not.' },
  { a: hiragana('あ'), b: hiragana('お'), note: 'Both are a cross with a loop below; the loops face opposite ways.' },
  { a: hiragana('い'), b: hiragana('り'), note: 'Two near-parallel strokes in both; り joins at the top, い does not.' },
];

/** The katakana equivalents, including the pair §5.3 names by hand. */
const KATAKANA_SHAPE_CONTRASTS: ContrastSeed[] = [
  { a: katakana('シ'), b: katakana('ツ'), note: 'Same three strokes rotated — シ opens right, ツ opens down. The canonical katakana confusion.' },
  { a: katakana('ソ'), b: katakana('ン'), note: 'Two strokes differing only in which one is steep.' },
  { a: katakana('ス'), b: katakana('ヌ'), note: 'ヌ is ス with the diagonal crossing the first stroke.' },
  { a: katakana('マ'), b: katakana('ム'), note: 'Both a corner over a diagonal; ム has no horizontal top.' },
  { a: katakana('チ'), b: katakana('テ'), note: 'Both two horizontals and a stroke through; テ keeps the vertical straight.' },
  { a: katakana('ク'), b: katakana('タ'), note: 'タ is ク with an extra diagonal inside.' },
  { a: katakana('ウ'), b: katakana('ワ'), note: 'ワ is ウ without the top tick.' },
];

/**
 * Look-alikes **across** the two scripts, which only matter because this course
 * teaches both — and teaches them back to back, so both are live at once.
 */
const CROSS_SCRIPT_CONTRASTS: ContrastSeed[] = [
  { a: hiragana('へ'), b: katakana('ヘ'), note: 'Very nearly the same glyph in both scripts; only the stroke weight differs.' },
  { a: hiragana('り'), b: katakana('リ'), note: 'Same two strokes; the katakana pair stays separate and straight.' },
  { a: hiragana('か'), b: katakana('カ'), note: 'カ is か without the small third stroke.' },
  { a: hiragana('せ'), b: katakana('セ'), note: 'セ is せ with the final upstroke dropped.' },
  { a: hiragana('や'), b: katakana('ヤ'), note: 'Same shape, ヤ reduced to two strokes.' },
];

/**
 * Grammar points that compete for the same slot in a sentence, which is a
 * different kind of confusion from a shape: both options are *grammatical*, so
 * the learner has to choose on meaning.
 *
 * `ます / ません / ました` is the set the exercise generator already had to work
 * around — 「わたしはいき＿。」takes all three, which is why a grammar question
 * carries its English gloss. Recording the three-way contrast puts the reason in
 * the graph instead of only in a comment.
 */
const GRAMMAR_CONTRASTS: ContrastSeed[] = [
  { a: grammar('ます — polite present'), b: grammar('ません — polite negative'), note: 'Same slot, opposite polarity; the sentence is grammatical either way.' },
  { a: grammar('ます — polite present'), b: grammar('ました — polite past'), note: 'Same slot, different tense; only the intended meaning picks one.' },
  { a: grammar('ません — polite negative'), b: grammar('ました — polite past'), note: 'The two non-present endings, and the pair most often swapped.' },
  { a: grammar('に — destination'), b: grammar('で — place of action'), note: 'Both mark a place; に is where you go, で is where it happens.' },
  { a: grammar('を — object marker'), b: grammar('は — topic marker'), note: 'Both attach to the noun before the verb, marking different roles.' },
  { a: grammar('は — topic marker'), b: grammar('も — also'), note: 'も takes は’s place rather than joining it, so they cannot both appear.' },
  { a: grammar('の — possessive'), b: grammar('と — and'), note: 'Both join two nouns; の subordinates, と lists.' },
];

/**
 * Same glyph, two jobs — the case §5.3 calls out, and the one a shape contrast
 * cannot express because nothing *looks* different.
 */
const GLYPH_VS_ROLE_CONTRASTS: ContrastSeed[] = [
  {
    a: hiragana('は'),
    b: grammar('は — topic marker'),
    note: 'The character reads "ha"; doing this job it is pronounced "wa". The single most common surprise in beginner Japanese, and why romaji here is authored rather than transliterated.',
  },
  {
    a: hiragana('に'),
    b: grammar('に — destination'),
    note: 'に is both the commonest particle and the word for "two", which is why chat correction deliberately never schedules single-character matches.',
  },
];

export const CONTRASTS: ContrastSeed[] = [
  ...HIRAGANA_SHAPE_CONTRASTS,
  ...KATAKANA_SHAPE_CONTRASTS,
  ...CROSS_SCRIPT_CONTRASTS,
  ...GRAMMAR_CONTRASTS,
  ...GLYPH_VS_ROLE_CONTRASTS,
];

export interface RowConcept {
  slug: string;
  label: string;
  script: 'hiragana' | 'katakana';
  row: string;
  /** The characters this row groups, in pack order. */
  kana: string[];
}

/**
 * One concept per (script, row) — "the あ row" — derived from the packs rather
 * than listed, so a row added to a pack becomes a concept without anyone
 * remembering to add it here.
 *
 * The label leads with the row's first character because that is how the row is
 * named out loud: あ行 is "the あ row", not "the a row".
 */
export function rowConcepts(packs: KanaPack[]): RowConcept[] {
  const concepts: RowConcept[] = [];

  for (const pack of packs) {
    for (const [row, characters] of Object.entries(pack.rows)) {
      if (characters.length === 0) continue;
      const ordered = [...characters].sort((a, b) => a.order - b.order);
      concepts.push({
        slug: `row-${pack.script}-${row}`,
        label: `${ordered[0].kana} row (${pack.script})`,
        script: pack.script,
        row,
        kana: ordered.map((character) => character.kana),
      });
    }
  }

  return concepts;
}
