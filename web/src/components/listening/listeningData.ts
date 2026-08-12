import type { VocabItem } from '../library/useCorpus';

export const LISTENING_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'] as const;
export type ListeningLevel = (typeof LISTENING_LEVELS)[number];

export function listeningLevelRank(level: string): number {
  const index = LISTENING_LEVELS.indexOf(level as ListeningLevel);
  return index === -1 ? LISTENING_LEVELS.length : index;
}

/** Stable sorting retains course order inside each beginner-to-advanced level. */
export function sortListeningItems(items: VocabItem[]): VocabItem[] {
  return [...items].sort((left, right) => listeningLevelRank(left.jlpt) - listeningLevelRank(right.jlpt));
}

export function shuffleListening<T>(values: T[]): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap] as T, result[index] as T];
  }
  return result;
}

export function spokenText(item: VocabItem): string {
  return item.reading || item.lemma;
}
