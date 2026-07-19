import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { CONTENT_KINDS, ContentKind } from '../../knowledge-graph/schemas/knowledge-node.schema';

export type SrsState = 'new' | 'learning' | 'review' | 'relearning';
export const SRS_STATES: SrsState[] = ['new', 'learning', 'review', 'relearning'];

@Schema({ _id: false })
export class SrsItemRef {
  @Prop({ type: String, required: true, enum: CONTENT_KINDS })
  kind: ContentKind;

  @Prop({ type: Types.ObjectId, required: true })
  id: Types.ObjectId;
}
export const SrsItemRefSchema = SchemaFactory.createForClass(SrsItemRef);

/**
 * §5/§6: one card per (user, item). The FSRS fields are stored in §5's naming,
 * not ts-fsrs's — see `fsrs-card.mapper.ts` for the translation and why.
 */
@Schema({ collection: 'srsCards', timestamps: true })
export class SrsCard {
  @Prop({ type: Types.ObjectId, required: true })
  userId: Types.ObjectId;

  @Prop({ type: SrsItemRefSchema, required: true })
  itemRef: SrsItemRef;

  // ---- FSRS state (§6) ----

  @Prop({ type: Number, required: true, default: 0 })
  stability: number;

  @Prop({ type: Number, required: true, default: 0 })
  difficulty: number;

  @Prop({ type: Date, required: true })
  due: Date;

  @Prop({ type: Date, default: null })
  lastReview: Date | null;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  reps: number;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  lapses: number;

  @Prop({ type: String, required: true, enum: SRS_STATES, default: 'new' })
  state: SrsState;

  /**
   * The one field beyond §5, and it isn't optional: ts-fsrs tracks position in
   * the learning-step sequence (default 1m -> 10m) here, and it cannot be
   * derived from anything else on the card. Without persisting it, a card
   * re-enters step 0 on every grade and never graduates out of Learning — it
   * sits at "due in 10 minutes" forever. Measured, not assumed.
   */
  @Prop({ type: Number, required: true, default: 0, min: 0 })
  learningSteps: number;
}

export type SrsCardDocument = HydratedDocument<SrsCard>;
export const SrsCardSchema = SchemaFactory.createForClass(SrsCard);

// §5/§6: "give me this user's due cards" is the hottest query in the app and
// the only one that has to be fast. Mandated by CLAUDE.md.
SrsCardSchema.index({ userId: 1, due: 1 });

// One card per (user, item). This is what actually makes repeat completion
// safe under concurrency — the read-then-insert check below it is an
// optimisation, this is the guarantee.
SrsCardSchema.index({ userId: 1, 'itemRef.kind': 1, 'itemRef.id': 1 }, { unique: true });
