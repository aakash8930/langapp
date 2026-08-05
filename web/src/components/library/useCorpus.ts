import { useQuery } from '@tanstack/react-query';

import { fetchLessons, fetchUnitContent, type ResolvedItem } from '../../api';
import { log } from '../../debug';
import { queryKeys } from '../../queryKeys';

/**
 * Everything the syllabus teaches, in one cached collection.
 *
 * ## Why this is a fan-out and not one request
 *
 * `GET /units/:unit/content` is per-unit, so "every vocabulary word in the
 * course" is the union of eleven of those. Each is two database queries, they
 * run in parallel, and the result is cached under a single key — so the
 * Vocabulary, Kanji, Grammar and Dictionary screens share **one** fetch between
 * them, and moving between those screens costs nothing.
 *
 * The measured shape today: 11 units, 1126 unique items — 802 vocab, 208 kana,
 * 104 kanji, 12 grammar.
 *
 * A `?kind=` filter on the server would make this one request instead of
 * eleven. It is not worth adding yet: the eleven are parallel, small, cached
 * for an hour, and the union is what three of the four callers want anyway.
 * The moment the syllabus grows past a few dozen units, that changes.
 *
 * ## Deduplicated across units, not just within them
 *
 * The server dedupes by `(kind, id)` *within* a unit. Nothing stops the same
 * word being taught in both `vocab-everyday` and `vocab-n5`, so the union has
 * to dedupe again — otherwise a word taught twice appears twice in the list and
 * once in the count, which is the kind of discrepancy nobody can explain later.
 *
 * ## One slow unit does not empty the library
 *
 * `allSettled`, not `all`: a single unit failing would otherwise throw away the
 * other ten. A partial corpus is a usable library with something missing; an
 * empty one is a broken screen. Failures are logged and the caller is told how
 * many units are missing so it can say so.
 */
export type Corpus = {
  items: ResolvedItem[];
  /** Units whose content could not be loaded. Empty on a clean fetch. */
  failedUnits: string[];
};

async function fetchCorpus(): Promise<Corpus> {
  const lessons = await fetchLessons();
  const units = [...new Set(lessons.map((lesson) => lesson.unit))];

  const results = await Promise.allSettled(units.map((unit) => fetchUnitContent(unit)));

  const seen = new Set<string>();
  const items: ResolvedItem[] = [];
  const failedUnits: string[] = [];

  results.forEach((result, index) => {
    const unit = units[index] ?? '(unknown)';
    if (result.status === 'rejected') {
      failedUnits.push(unit);
      return;
    }
    for (const item of result.value.items) {
      const key = `${item.kind}:${item.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
  });

  log('api', 'corpus assembled', {
    units: units.length,
    items: items.length,
    failedUnits,
  });

  return { items, failedUnits };
}

export function useCorpus() {
  return useQuery({
    queryKey: queryKeys.content.corpus,
    queryFn: fetchCorpus,
    // The syllabus is reference content. Re-assembling it on every visit would
    // mean eleven requests to learn nothing changed.
    staleTime: 60 * 60_000,
  });
}

/** Narrowing helpers — `ResolvedItem` is a union and every screen wants one arm. */
export type VocabItem = Extract<ResolvedItem, { kind: 'vocab' }>;
export type KanjiItem = Extract<ResolvedItem, { kind: 'kanji' }>;
export type GrammarItem = Extract<ResolvedItem, { kind: 'grammar' }>;

export function itemsOfKind<K extends ResolvedItem['kind']>(
  items: ResolvedItem[],
  kind: K,
): Extract<ResolvedItem, { kind: K }>[] {
  return items.filter(
    (item): item is Extract<ResolvedItem, { kind: K }> => item.kind === kind,
  );
}

/**
 * The text a search matches against, per item kind.
 *
 * Case-folded substring, not fuzzy — the same choice `CommandPalette` made and
 * for the same reason: over a corpus this size fuzzy matching mostly buys false
 * positives, and someone typing "water" wants 水 rather than everything
 * containing w, a, t, e and r in order.
 */
export function searchableText(item: ResolvedItem): string {
  switch (item.kind) {
    case 'kana':
      return `${item.kana} ${item.romaji} ${item.script}`;
    case 'vocab':
      return `${item.lemma} ${item.reading} ${item.romaji ?? ''} ${item.gloss} ${item.pos}`;
    case 'kanji':
      return `${item.char} ${item.meanings.join(' ')} ${item.on.join(' ')} ${item.kun.join(' ')}`;
    case 'grammar':
      return `${item.title} ${item.explanation}`;
  }
}
