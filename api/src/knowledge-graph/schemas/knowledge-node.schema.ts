import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ContentKind = 'vocab' | 'grammar' | 'kanji' | 'kana';
export const CONTENT_KINDS: ContentKind[] = ['vocab', 'grammar', 'kanji', 'kana'];

/**
 * §5: one node per concept. `refId` points at the content document that the
 * node stands for; the graph itself stays free of content detail.
 */
@Schema({ collection: 'knowledgeNodes', timestamps: true })
export class KnowledgeNode {
  @Prop({ type: String, required: true, enum: ['ja'], default: 'ja' })
  lang: 'ja';

  @Prop({ type: String, required: true, enum: CONTENT_KINDS })
  kind: ContentKind;

  @Prop({ type: Types.ObjectId, required: true })
  refId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  label: string;
}

export type KnowledgeNodeDocument = HydratedDocument<KnowledgeNode>;
export const KnowledgeNodeSchema = SchemaFactory.createForClass(KnowledgeNode);

// "which node represents this content doc" — the lookup the seed and the
// learning module both need. Unique because a content doc has exactly one node.
KnowledgeNodeSchema.index({ kind: 1, refId: 1 }, { unique: true });
KnowledgeNodeSchema.index({ lang: 1, kind: 1 });
