import { GrammarPointDocument } from '../schemas/grammar-point.schema';

/**
 * Phase 3 #15 — One grammar example projected for the bare reading screen.
 *
 * Mirrors `VocabReadabilityRow` for the sentence side. The reader is
 * `findSentencesByKnownKana`, which filters grammar examples by
 * `constituentKana ⊆ knownKana` exactly the same way `findVocabByKnownKana`
 * filters words. Every character in `constituentKana` is in the learner's
 * `knownKana` — the same guarantee the vocab reader makes.
 *
 * The `grammarPointId` is included so the client can navigate to the parent
 * lesson / explainer; `exampleIndex` lets it highlight the specific example
 * inside the point when it has more than one (the schema defaults `examples`
 * to `[]` but the seed gives every point at least one).
 */
export interface SentenceReadabilityRow {
  id: string;
  grammarPointId: string;
  exampleIndex: number;
  sentence: string;
  answer: string;
  romaji: string | null;
  gloss: string;
  constituentKana: string[];
}

export function toSentenceReadabilityRow(
  doc: GrammarPointDocument,
  exampleIndex: number,
): SentenceReadabilityRow {
  const example = doc.examples[exampleIndex];
  return {
    // The grammar point's own id is the row's id; example-level identity is
    // (point, index), encoded explicitly so a client can pin a sibling list.
    id: doc._id.toString(),
    grammarPointId: doc._id.toString(),
    exampleIndex,
    sentence: example.sentence,
    answer: example.answer,
    romaji: example.romaji ?? null,
    gloss: example.gloss,
    constituentKana: example.constituentKana ?? [],
  };
}
