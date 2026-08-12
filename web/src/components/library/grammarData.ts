import type { GrammarItem } from './useCorpus';

/** The beginner-to-advanced JLPT order used on every grammar surface. */
export const GRAMMAR_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'] as const;
export type GrammarLevel = (typeof GRAMMAR_LEVELS)[number];

export function grammarLevelRank(level: string): number {
  const index = GRAMMAR_LEVELS.indexOf(level as GrammarLevel);
  return index === -1 ? GRAMMAR_LEVELS.length : index;
}

/** Stable sorting preserves curriculum order inside each JLPT level. */
export function sortGrammarByLevel(items: GrammarItem[]): GrammarItem[] {
  return [...items].sort((left, right) => grammarLevelRank(left.jlpt) - grammarLevelRank(right.jlpt));
}

export function splitGrammarTitle(title: string): { form: string; label: string } {
  const separator = title.includes(' — ') ? ' — ' : title.includes(' - ') ? ' - ' : null;
  if (!separator) return { form: title, label: 'Grammar pattern' };
  const [form, ...label] = title.split(separator);
  return { form: form?.trim() || title, label: label.join(separator).trim() || 'Grammar pattern' };
}

export function completedGrammarSentence(sentence: string, answer: string): string {
  return sentence.replace(/＿/g, answer);
}

export function shuffleGrammar<T>(values: T[]): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap] as T, result[index] as T];
  }
  return result;
}
