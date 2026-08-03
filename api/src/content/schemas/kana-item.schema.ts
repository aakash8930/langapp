import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/**
 * Not in §5 — added for Phase 0 because §5's `itemRefs.kind` and
 * `KnowledgeNode.kind` both already list 'kana', so kana was always meant to be
 * its own kind rather than a vocabulary word.
 *
 * Deliberately minimal: stroke counts and audio keys arrive when the stroke-order
 * UI and TTS do. `script` covers katakana already, so that milestone is a seed
 * change, not a migration.
 */
@Schema({ collection: 'kanaItems', timestamps: true })
export class KanaItem {
  @Prop({ type: String, required: true, enum: ['ja'], default: 'ja' })
  lang: 'ja';

  @Prop({ required: true, trim: true })
  kana: string;

  @Prop({ required: true, lowercase: true, trim: true })
  romaji: string;

  @Prop({ type: String, required: true, enum: ['hiragana', 'katakana'] })
  script: 'hiragana' | 'katakana';

  /** Row in the gojūon table: 'a', 'ka', 'sa', 'ta', 'na', … */
  @Prop({ required: true, lowercase: true, trim: true })
  row: string;

  /** Position within the row, so あいうえお keeps its canonical order. */
  @Prop({ required: true, min: 0 })
  order: number;

  @Prop({ type: Types.ObjectId, required: false })
  conceptId?: Types.ObjectId;

  /**
   * Phase 0 — Data foundation: the lesson that first teaches this character.
   * A single number rather than a list because every kana belongs to exactly one
   * introductory lesson (the lesson that introduces the row it lives in).
   *
   * Stored as a copy of `Lesson.order` *within* the lesson's unit — not a
   * Mongo `ObjectId` and not a global "lesson index". Reason: `/lessons/curriculum`
   * walks `(script, row, order)` and callers want "taught in lesson N of unit X"
   * without a second query, so a plain integer scopes the lookup and matches the
   * already-lexicographic ordering without further work.
   *
   * `required: false` because every existing document written before this column
   * landed lacks the field. The Phase 0 migration (`npm run migrate:phase0-data`)
   * backfills it from the seed packs; absent therefore means "not yet
   * backfilled", and the curriculum endpoint treats absent as "no lesson" so a
   * missing value is harmless until the migration runs.
   */
  @Prop({ type: Number, required: false, min: 0 })
  taughtInLesson?: number;
}

export type KanaItemDocument = HydratedDocument<KanaItem>;
export const KanaItemSchema = SchemaFactory.createForClass(KanaItem);

// Ordered reads of a row/table — how a lesson lists its characters.
KanaItemSchema.index({ lang: 1, script: 1, row: 1, order: 1 });
// One document per character per script.
KanaItemSchema.index({ lang: 1, script: 1, kana: 1 }, { unique: true });
// Phase 0: lesson-curriculum lookup — "give me every character taught in
// lesson N of unit U". Partial index because backfill leaves the field unset
// on rows that pre-date the migration; the query is interested only in
// `where taughtInLesson is set`, so the index sizes only on the populated set.
KanaItemSchema.index(
  { lang: 1, script: 1, taughtInLesson: 1, order: 1 },
  { partialFilterExpression: { taughtInLesson: { $type: 'number' } } },
);
