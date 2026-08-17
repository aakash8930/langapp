import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { JLPT_LEVELS, JlptLevel } from './vocab-item.schema';

/**
 * A worked example of a grammar point, with a gap where the point itself goes.
 *
 * This is an intentional departure from the original content schema, and it exists because a grammar quiz has to ask something.
 * The only question this app can generate is multiple choice, and the useful
 * multiple-choice question about a particle is "which one fills this gap" —
 * which needs a sentence with a gap in it. §5's GrammarPoint has title, jlpt
 * and explanation, none of which can carry one.
 */
@Schema({ _id: false })
export class GrammarExample {
  /** The sentence, containing exactly one ＿ where the answer belongs. */
  @Prop({ required: true, trim: true })
  sentence: string;

  @Prop({ required: true, trim: true })
  answer: string;

  /**
   * The **completed** sentence in latin script — 「わたしはせんせいです。」 is
   * `watashi wa sensei desu.`
   *
   * Never shown beside the gapped sentence in a quiz: it contains the answer.
   * This is the study side only.
   */
  @Prop({ type: String, required: false, trim: true })
  romaji?: string;

  /**
   * English translation of the completed sentence — load-bearing, not
   * decoration. 「わたしはいき＿。」 is grammatical with ます, ません and ました
   * alike; only the gloss says which is meant.
   */
  @Prop({ required: true, trim: true })
  gloss: string;

  /**
   * Unique kana characters in `sentence`, de-duplicated by first occurrence.
   * Stored, not derived on read, because the reader is the budget path and we
   * do not want to walk a sentence codepoint by codepoint for every row on
   * every request. Phase 3 #15: powers `findSentencesByKnownKana`, the
   * sentence-side parallel to `findVocabByKnownKana`. Seeded by the grammar
   * pack via `decomposeIntoKana`; absent on pre-seed documents, and the
   * reader treats `undefined` as "no kana matched" (effectively invisible to
   * the constrained filter, which is the safe default).
   */
  @Prop({ type: [String], default: [] })
  constituentKana: string[];
}

const GrammarExampleSchema = SchemaFactory.createForClass(GrammarExample);

/** §5, plus `examples` — see the note on GrammarExample above. */
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

  /** The quiz uses the first; the rest are there for a card to show. */
  @Prop({ type: [GrammarExampleSchema], default: [] })
  examples: GrammarExample[];

  @Prop({ type: String, required: false })
  usage?: string;

  @Prop({
    type: [{ mistake: String, correction: String, note: String }],
    default: [],
  })
  commonMistakes: { mistake: string; correction: string; note: string }[];

  @Prop({ type: Types.ObjectId, required: false })
  conceptId?: Types.ObjectId;
}

export type GrammarPointDocument = HydratedDocument<GrammarPoint>;
export const GrammarPointSchema = SchemaFactory.createForClass(GrammarPoint);

GrammarPointSchema.index({ lang: 1, title: 1 }, { unique: true });
GrammarPointSchema.index({ lang: 1, jlpt: 1 });
