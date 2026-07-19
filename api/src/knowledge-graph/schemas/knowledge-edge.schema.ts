import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type EdgeType = 'prerequisite' | 'contains' | 'related' | 'usesKanji';
export const EDGE_TYPES: EdgeType[] = ['prerequisite', 'contains', 'related', 'usesKanji'];

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
