import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type JlptLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
export const JLPT_LEVELS: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];

/** §5 verbatim: shared, language-scoped, immutable-ish content. */
@Schema({ collection: 'vocabItems', timestamps: true })
export class VocabItem {
  @Prop({ type: String, required: true, enum: ['ja'], default: 'ja' })
  lang: 'ja';

  /** 食べる */
  @Prop({ required: true, trim: true })
  lemma: string;

  /** たべる */
  @Prop({ required: true, trim: true })
  reading: string;

  /** to eat */
  @Prop({ required: true, trim: true })
  gloss: string;

  @Prop({ required: true, trim: true })
  pos: string;

  @Prop({ type: String, required: true, enum: JLPT_LEVELS })
  jlpt: JlptLevel;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: Types.ObjectId, required: false })
  conceptId?: Types.ObjectId;
}

export type VocabItemDocument = HydratedDocument<VocabItem>;
export const VocabItemSchema = SchemaFactory.createForClass(VocabItem);

VocabItemSchema.index({ lang: 1, lemma: 1 }, { unique: true });
VocabItemSchema.index({ lang: 1, jlpt: 1 });
VocabItemSchema.index({ tags: 1 });
