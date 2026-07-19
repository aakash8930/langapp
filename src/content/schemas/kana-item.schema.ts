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
}

export type KanaItemDocument = HydratedDocument<KanaItem>;
export const KanaItemSchema = SchemaFactory.createForClass(KanaItem);

// Ordered reads of a row/table — how a lesson lists its characters.
KanaItemSchema.index({ lang: 1, script: 1, row: 1, order: 1 });
// One document per character per script.
KanaItemSchema.index({ lang: 1, script: 1, kana: 1 }, { unique: true });
