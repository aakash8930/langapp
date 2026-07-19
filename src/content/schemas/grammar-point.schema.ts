import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { JLPT_LEVELS, JlptLevel } from './vocab-item.schema';

/** §5 verbatim. */
@Schema({ collection: 'grammarPoints', timestamps: true })
export class GrammarPoint {
  @Prop({ type: String, required: true, enum: ['ja'], default: 'ja' })
  lang: 'ja';

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ type: String, required: true, enum: JLPT_LEVELS })
  jlpt: JlptLevel;

  @Prop({ required: true })
  explanation: string;

  @Prop({ type: Types.ObjectId, required: false })
  conceptId?: Types.ObjectId;
}

export type GrammarPointDocument = HydratedDocument<GrammarPoint>;
export const GrammarPointSchema = SchemaFactory.createForClass(GrammarPoint);

GrammarPointSchema.index({ lang: 1, title: 1 }, { unique: true });
GrammarPointSchema.index({ lang: 1, jlpt: 1 });
