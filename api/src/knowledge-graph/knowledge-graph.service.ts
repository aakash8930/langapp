import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ContentKind,
  KnowledgeNode,
  KnowledgeNodeDocument,
} from './schemas/knowledge-node.schema';
import { EdgeType, KnowledgeEdge, KnowledgeEdgeDocument } from './schemas/knowledge-edge.schema';

export interface UpsertNodeInput {
  kind: ContentKind;
  refId: Types.ObjectId;
  label: string;
}

/**
 * Owns knowledgeNodes and knowledgeEdges. Content, learning and (later) the AI
 * orchestrator reach the graph only through this class.
 */
@Injectable()
export class KnowledgeGraphService {
  constructor(
    @InjectModel(KnowledgeNode.name)
    private readonly nodeModel: Model<KnowledgeNodeDocument>,
    @InjectModel(KnowledgeEdge.name)
    private readonly edgeModel: Model<KnowledgeEdgeDocument>,
  ) {}

  /** Idempotent, so re-running the seed doesn't duplicate the graph. */
  async upsertNode(input: UpsertNodeInput): Promise<KnowledgeNodeDocument> {
    const node = await this.nodeModel
      .findOneAndUpdate(
        { kind: input.kind, refId: input.refId },
        { $set: { label: input.label, lang: 'ja' } },
        { new: true, upsert: true },
      )
      .exec();

    return node;
  }

  async upsertEdge(
    from: Types.ObjectId,
    to: Types.ObjectId,
    type: EdgeType,
  ): Promise<KnowledgeEdgeDocument> {
    return this.edgeModel
      .findOneAndUpdate({ from, to, type }, { $setOnInsert: { from, to, type } }, {
        new: true,
        upsert: true,
      })
      .exec();
  }

  async findNodeByRef(kind: ContentKind, refId: Types.ObjectId): Promise<KnowledgeNodeDocument | null> {
    return this.nodeModel.findOne({ kind, refId }).exec();
  }

  async findNodesByIds(ids: Types.ObjectId[]): Promise<KnowledgeNodeDocument[]> {
    return this.nodeModel.find({ _id: { $in: ids } }).exec();
  }

  /** "What must be known before this node" — one indexed lookup (§5). */
  async findPrerequisites(nodeId: Types.ObjectId): Promise<KnowledgeNodeDocument[]> {
    const edges = await this.edgeModel.find({ to: nodeId, type: 'prerequisite' }).exec();
    return this.findNodesByIds(edges.map((edge) => edge.from));
  }

  /** "What this node unlocks" — the inverse, for surfacing what's next. */
  async findDependents(nodeId: Types.ObjectId): Promise<KnowledgeNodeDocument[]> {
    const edges = await this.edgeModel.find({ from: nodeId, type: 'prerequisite' }).exec();
    return this.findNodesByIds(edges.map((edge) => edge.to));
  }

  async countNodes(): Promise<number> {
    return this.nodeModel.countDocuments().exec();
  }

  async countEdges(): Promise<number> {
    return this.edgeModel.countDocuments().exec();
  }

  /** Seed support only — never call this from a request path. */
  async clear(): Promise<void> {
    await Promise.all([this.nodeModel.deleteMany({}).exec(), this.edgeModel.deleteMany({}).exec()]);
  }
}
