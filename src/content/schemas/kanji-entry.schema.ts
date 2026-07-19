import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { JLPT_LEVELS, JlptLevel } from './vocab-item.schema';

/** §5 verbatim. */
@Schema({ collection: 'kanjiEntries', timestamps: true })
export class KanjiEntry {
  @Prop({ type: String, required: true, enum: ['ja'], default: 'ja' })
  lang: 'ja';

  @Prop({ required: true, trim: true })
  char: string;

  @Prop({ type: [String], default: [] })
  on: string[];

  @Prop({ type: [String], default: [] })
  kun: string[];

  @Prop({ type: [String], default: [] })
  meanings: string[];

  @Prop({ required: true, min: 1 })
  strokes: number;

  @Prop({ required: true, trim: true })
  radical: string;

  @Prop({ type: String, required: true, enum: JLPT_LEVELS })
  jlpt: JlptLevel;

  @Prop({ type: Types.ObjectId, required: false })
  conceptId?: Types.ObjectId;
}

export type KanjiEntryDocument = HydratedDocument<KanjiEntry>;
export const KanjiEntrySchema = SchemaFactory.createForClass(KanjiEntry);

KanjiEntrySchema.index({ lang: 1, char: 1 }, { unique: true });
KanjiEntrySchema.index({ lang: 1, jlpt: 1 });
