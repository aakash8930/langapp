import type { KanjiItem } from './useCorpus';

/** Beginner-to-advanced ordering used by every kanji study surface. */
export const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'] as const;
export type JlptLevel = (typeof JLPT_LEVELS)[number];

export function jlptRank(level: string): number {
  const index = JLPT_LEVELS.indexOf(level as JlptLevel);
  return index === -1 ? JLPT_LEVELS.length : index;
}

/** Stable sorting preserves the curriculum order inside each JLPT level. */
export function sortKanjiByLevel(items: KanjiItem[]): KanjiItem[] {
  return [...items].sort((left, right) => jlptRank(left.jlpt) - jlptRank(right.jlpt));
}
