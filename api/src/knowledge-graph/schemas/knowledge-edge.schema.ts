import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/**
 * `contrasts-with` was added by ADR-005 / §5.3, and it is the pedagogically
 * load-bearing one: シ/ツ, は-as-particle vs は-as-syllable, ます/ました. These are
 * the pairs learners actually confuse, and the exercise generator already
 * benefits from them by accident — a distractor drawn from the unit pool
 * sometimes puts ツ beside シ. Recording them makes that deliberate.
 *
 * It is **symmetric**, and edges here are directed, so both directions are
 * written (see `SeedService.syncConceptGraph`). That keeps "what contrasts with
 * this" a single indexed lookup on `from` instead of a query per direction.
 *
 * `related` and `usesKanji` predate this and were declared but never created;
 * `usesKanji` is populated as of ADR-005 slice 3 — a word points at the kanji it
 * is written with. `related` is still unused.
 */
export type EdgeType = 'prerequisite' | 'contains' | 'related' | 'usesKanji' | 'contrasts-with';
export const EDGE_TYPES: EdgeType[] = [
  'prerequisite',
  'contains',
  'related',
  'usesKanji',
  'contrasts-with',
];

/**
 * §5: the graph is an adjacency list in Mongo — nodes plus edges, no graph
 * database. At Phase 0 scale "what are X's prerequisites" is one indexed
 * lookup. Revisit only if traversals get deep and hot.
 */
@Schema({ collection: 'knowledgeEdges', timestamps: true })
export class KnowledgeEdge {
  @Prop({ type: Types.ObjectId, ref: 'KnowledgeNode', required: true })
  from: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'KnowledgeNode', required: true })
  to: Types.ObjectId;

  @Prop({ type: String, required: true, enum: EDGE_TYPES })
  type: EdgeType;
}

export type KnowledgeEdgeDocument = HydratedDocument<KnowledgeEdge>;
export const KnowledgeEdgeSchema = SchemaFactory.createForClass(KnowledgeEdge);

// Outbound traversal: "what does this node point to, of this type".
KnowledgeEdgeSchema.index({ from: 1, type: 1 });
// Inbound traversal: "what depends on this node" — needed to unlock successors.
KnowledgeEdgeSchema.index({ to: 1, type: 1 });
// An edge of a given type exists at most once between two nodes.
KnowledgeEdgeSchema.index({ from: 1, to: 1, type: 1 }, { unique: true });
