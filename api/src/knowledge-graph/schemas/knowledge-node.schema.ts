import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ContentKind = 'vocab' | 'grammar' | 'kanji' | 'kana' | 'lesson';
export const CONTENT_KINDS: ContentKind[] = ['vocab', 'grammar', 'kanji', 'kana', 'lesson'];

/**
 * What a graph node can be. Every `ContentKind` stands for a document, plus
 * `'concept'` — an idea with no document behind it (ADR-005 / §5.3): "the あ
 * row", "な-adjectives", "the が/は distinction".
 *
 * Kept separate from `ContentKind` on purpose. `ItemRef` on the lesson schema
 * uses `CONTENT_KINDS` as its enum, and a lesson's items must stay documents —
 * widening that enum would let a lesson claim to contain an abstraction, which
 * `resolveItemRefs` has no collection to dispatch to.
 */
export type NodeKind = ContentKind | 'concept';
export const NODE_KINDS: NodeKind[] = [...CONTENT_KINDS, 'concept'];

/**
 * §5: one node per concept. A content-backed node has a `refId` pointing at the
 * document it stands for; the graph itself stays free of content detail.
 *
 * ## Identity, and why it is two fields (ADR-005)
 *
 * `refId` **cannot** be required any more, because a concept has no document to
 * point at, and inventing a synthetic id for it would make `refId` mean "the
 * document this stands for, except sometimes nothing". So identity splits by what
 * a node is: content-backed nodes are unique per `{kind, refId}`, concepts are
 * unique per `{lang, slug}`.
 *
 * Both indexes are **partial**, which is what makes them coexist: a plain unique
 * `{kind, refId}` treats a missing `refId` as null, so the *second* concept ever
 * created would collide with the first. Anything writing here must therefore leave
 * the irrelevant field **absent rather than null** — `$exists: true` matches an
 * explicit null, so storing `refId: null` would re-create exactly that collision.
 */
@Schema({ collection: 'knowledgeNodes', timestamps: true })
export class KnowledgeNode {
  @Prop({ type: String, required: true, enum: ['ja'], default: 'ja' })
  lang: 'ja';

  @Prop({ type: String, required: true, enum: NODE_KINDS })
  kind: NodeKind;

  /** Absent on `concept` nodes. See the class doc. */
  @Prop({ type: Types.ObjectId, required: false })
  refId?: Types.ObjectId;

  /** Present only on `concept` nodes — their stable, authored identity. */
  @Prop({ type: String, required: false, trim: true })
  slug?: string;

  @Prop({ required: true, trim: true })
  label: string;
}

export type KnowledgeNodeDocument = HydratedDocument<KnowledgeNode>;
export const KnowledgeNodeSchema = SchemaFactory.createForClass(KnowledgeNode);

// "which node represents this content doc" — the lookup the seed and the
// learning module both need. Unique because a content doc has exactly one node.
//
// Partial, and **renamed** from the plain `kind_1_refId_1` it replaces: an
// existing non-partial index cannot be redefined in place, so this needs
// `syncIndexes()` (called by the seed) to drop the old one. Safe to drop because
// these two collections are entirely derived from content — see
// `KnowledgeGraphService.syncIndexes`.
KnowledgeNodeSchema.index(
  { kind: 1, refId: 1 },
  {
    unique: true,
    partialFilterExpression: { refId: { $exists: true } },
    name: 'kind_refId_unique_when_present',
  },
);
// A concept's identity is its slug, one per language.
KnowledgeNodeSchema.index(
  { lang: 1, slug: 1 },
  {
    unique: true,
    partialFilterExpression: { slug: { $exists: true } },
    name: 'lang_slug_unique_when_present',
  },
);
KnowledgeNodeSchema.index({ lang: 1, kind: 1 });
