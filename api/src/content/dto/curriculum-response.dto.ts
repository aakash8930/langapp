import { KanaItemDocument } from '../schemas/kana-item.schema';

/**
 * Phase 0 — Data foundation response: the ordered list of kana that constitutes
 * the curriculum. One document per kana, with its `taughtInLesson` if backfilled.
 *
 * Distinct from `LessonSummary` because it answers the *character-order* question
 * ("what comes next, in what row, taught by what lesson number?") rather than
 * the *lesson-order* question (`/lessons?unit=`). The two overlap — every
 * `taughtInLesson: N` row corresponds to a lesson at `order: N` in its unit —
 * but exposing one without the other would force callers to join them.
 *
 * The contract is conservative on missing data:
 *  - `taughtInLesson` is `null` when the migration hasn't run yet, so a caller
 *    who distinguishes "not yet attributed" from "first lesson" can, while
 *    a caller who treats both as "taught at the start" gets a sensible default.
 *  - rows where `taughtInLesson` is unset are *included* in the response
 *    (they are kana; we just don't know which lesson), so the list stays
 *    the canonical gojūon regardless of migration state.
 */
export interface KanaCurriculumRow {
  id: string;
  script: 'hiragana' | 'katakana';
  kana: string;
  romaji: string;
  row: string;
  order: number;
  /**
   * `lesson.order` of the lesson that teaches this character. `null` when
   * the migration has not yet attributed this character to a lesson.
   */
  taughtInLesson: number | null;
}

export interface CurriculumResponse {
  lang: 'ja';
  /** All kana rows ordered by `(script, row, order)` — the canonical gojūon order. */
  rows: KanaCurriculumRow[];
}

export function toCurriculumRow(doc: KanaItemDocument): KanaCurriculumRow {
  return {
    id: doc._id.toString(),
    script: doc.script,
    kana: doc.kana,
    romaji: doc.romaji,
    row: doc.row,
    order: doc.order,
    taughtInLesson: doc.taughtInLesson ?? null,
  };
}
