import { CONTRASTS, ContrastRef, rowConcepts } from './concepts';
import { GRAMMAR_GROUPS } from './grammar';
import { HIRAGANA_PACK } from './hiragana';
import { HIRAGANA_MARKS_PACK } from './hiragana-marks';
import type { KanaPack } from './kana-pack';
import { KATAKANA_PACK } from './katakana';
import { KATAKANA_MARKS_PACK } from './katakana-marks';

const PACKS: KanaPack[] = [
  HIRAGANA_PACK,
  KATAKANA_PACK,
  HIRAGANA_MARKS_PACK,
  KATAKANA_MARKS_PACK,
];

const TAUGHT_KANA = new Set(
  PACKS.flatMap((pack) =>
    Object.values(pack.rows).flatMap((characters) =>
      characters.map((character) => `${pack.script}:${character.kana}`),
    ),
  ),
);

const TAUGHT_GRAMMAR = new Set(
  Object.values(GRAMMAR_GROUPS).flatMap((points) => points.map((point) => point.title)),
);

function describeRef(ref: ContrastRef): string {
  return ref.kind === 'kana' ? `${ref.script}:${ref.kana}` : `grammar:${ref.title}`;
}

function refExists(ref: ContrastRef): boolean {
  return ref.kind === 'kana'
    ? TAUGHT_KANA.has(`${ref.script}:${ref.kana}`)
    : TAUGHT_GRAMMAR.has(ref.title);
}

/**
 * The gate on authored data (ADR-005 / §5.3). `contrasts-with` edges drive what a
 * learner is told they confuse, and eventually which distractors a question
 * offers, so a pair naming something the course never teaches is a claim about
 * nothing. The list is hand-written, and this is what makes it checkable —
 * the same discipline `romaji.spec.ts` applies to transliteration.
 */
describe('contrast pairs (ADR-005)', () => {
  it('only references kana the packs actually teach', () => {
    const missing = CONTRASTS.flatMap((contrast) =>
      [contrast.a, contrast.b].filter((ref) => ref.kind === 'kana' && !refExists(ref)),
    ).map(describeRef);

    expect(missing).toEqual([]);
  });

  /**
   * The check that earned its place: §5.3 asks for a が/は contrast, and the
   * course teaches は as a topic marker but never が as a subject marker. Writing
   * that pair would fail here rather than seeding a distinction no lesson draws.
   */
  it('only references grammar points the course actually teaches', () => {
    const missing = CONTRASTS.flatMap((contrast) =>
      [contrast.a, contrast.b].filter((ref) => ref.kind === 'grammar' && !refExists(ref)),
    ).map(describeRef);

    expect(missing).toEqual([]);
  });

  it('would reject a pair naming untaught content', () => {
    // Guards the guard: if `refExists` ever returned true unconditionally, every
    // test above would pass vacuously.
    expect(refExists({ kind: 'grammar', title: 'が — subject marker' })).toBe(false);
    expect(refExists({ kind: 'kana', script: 'hiragana', kana: '𛀁' })).toBe(false);
  });

  it('never contrasts something with itself', () => {
    const selfPairs = CONTRASTS.filter(
      (contrast) => describeRef(contrast.a) === describeRef(contrast.b),
    ).map((contrast) => describeRef(contrast.a));

    expect(selfPairs).toEqual([]);
  });

  /**
   * The relation is symmetric, so listing シ/ツ and ツ/シ would seed the same fact
   * twice and let the two copies disagree about the note.
   */
  it('lists each pair once, in one direction only', () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];

    for (const contrast of CONTRASTS) {
      const key = [describeRef(contrast.a), describeRef(contrast.b)].sort().join(' ~ ');
      if (seen.has(key)) duplicates.push(key);
      seen.add(key);
    }

    expect(duplicates).toEqual([]);
  });

  it('explains every pair, because the note is the justification for the edge', () => {
    const unexplained = CONTRASTS.filter((contrast) => contrast.note.trim().length < 20).map(
      (contrast) => `${describeRef(contrast.a)} ~ ${describeRef(contrast.b)}`,
    );

    expect(unexplained).toEqual([]);
  });
});

describe('rowConcepts (ADR-005)', () => {
  it('derives one concept per row of each pack, so a new row cannot be forgotten', () => {
    const expected = PACKS.reduce(
      (total, pack) =>
        total + Object.values(pack.rows).filter((characters) => characters.length > 0).length,
      0,
    );

    expect(rowConcepts(PACKS)).toHaveLength(expected);
  });

  it('gives every concept a unique slug, since the slug is its identity in the graph', () => {
    const slugs = rowConcepts(PACKS).map((concept) => concept.slug);

    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('keeps the row in pack order and names it after its first character', () => {
    const aRow = rowConcepts([HIRAGANA_PACK]).find((concept) => concept.row === 'a');

    expect(aRow).toBeDefined();
    expect(aRow?.kana).toEqual(['あ', 'い', 'う', 'え', 'お']);
    expect(aRow?.label).toBe('あ row (hiragana)');
    expect(aRow?.slug).toBe('row-hiragana-a');
  });

  it('only groups kana the packs teach', () => {
    for (const concept of rowConcepts(PACKS)) {
      for (const kana of concept.kana) {
        expect(TAUGHT_KANA.has(`${concept.script}:${kana}`)).toBe(true);
      }
    }
  });
});
