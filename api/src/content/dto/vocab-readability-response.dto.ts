import { VocabItemDocument } from '../schemas/vocab-item.schema';

/**
 * Phase 0 — Data foundation. One vocabulary item projected for the bare
 * reading screen (Phase 0 #4) and any later consumer that wants to render a
 * "can the learner read this?" surface.
 *
 * The shape is intentionally narrower than the resolved-item shape on the
 * `/lessons/:id` path — bare reading does not need exercise payloads or
 * position metadata; it needs the lemma, the kana reading, and the romaji
 * fallback for learners who are still decoding kana.
 *
 * `constituentKana` is included so the client can show "this word uses the
 * kana you've already learned" if it wants, but the server has already
 * filtered to the known set: every character in the array is in the learner's
 * `knownKana`. That is the *guarantee* the bare reading screen makes —
 * not "words the learner might be able to read".
 */
export interface VocabReadabilityRow {
  id: string;
  lemma: string;
  reading: string;
  /** Up to N4; absent beyond. Authored, not derived — see `vocab-item.schema.ts`. */
  romaji: string | null;
  gloss: string;
  jlpt: string;
  constituentKana: string[];
}

export function toVocabReadabilityRow(doc: VocabItemDocument): VocabReadabilityRow {
  return {
    id: doc._id.toString(),
    lemma: doc.lemma,
    reading: doc.reading,
    romaji: doc.romaji ?? null,
    gloss: doc.gloss,
    jlpt: doc.jlpt,
    constituentKana: doc.constituentKana ?? [],
  };
}
