import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { CONTENT_KINDS, ContentKind } from '../../knowledge-graph/schemas/knowledge-node.schema';

/**
 * §5: an ordered set of items plus an exercise recipe. `itemRefs` is a
 * polymorphic reference — `kind` says which collection `id` lives in, which is
 * what ContentService.resolveItems dispatches on.
 */
@Schema({ _id: false })
export class ItemRef {
  @Prop({ type: String, required: true, enum: CONTENT_KINDS })
  kind: ContentKind;

  @Prop({ type: Types.ObjectId, required: true })
  id: Types.ObjectId;
}
export const ItemRefSchema = SchemaFactory.createForClass(ItemRef);

@Schema({ collection: 'lessons', timestamps: true })
export class Lesson {
  @Prop({ type: String, required: true, enum: ['ja'], default: 'ja' })
  lang: 'ja';

  /** 'hiragana-basics' — the unit a lesson belongs to. */
  @Prop({ required: true, trim: true })
  unit: string;

  /** Position within the unit. Drives the ordering of GET /lessons?unit=. */
  @Prop({ required: true, min: 0 })
  order: number;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ type: [ItemRefSchema], default: [] })
  itemRefs: ItemRef[];

  @Prop({ type: [String], default: [] })
  exerciseTypes: string[];

  @Prop({ type: [Types.ObjectId], ref: 'Lesson', default: [] })
  prerequisiteLessonIds: Types.ObjectId[];
}

export type LessonDocument = HydratedDocument<Lesson>;
export const LessonSchema = SchemaFactory.createForClass(Lesson);

// Serves GET /lessons?unit= (fetches a unit already in order) and enforces one
// lesson per slot, which is what lets the seed upsert instead of duplicating.
LessonSchema.index({ lang: 1, unit: 1, order: 1 }, { unique: true });
