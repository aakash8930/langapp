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

  /**
   * The batched form of `findNodeByRef` — one query per kind instead of one per
   * item. The graph rebuild needs a node id for every item in every lesson,
   * which is roughly 1100 lookups done singly.
   */
  async findNodesByRefs(
    kind: ContentKind,
    refIds: Types.ObjectId[],
  ): Promise<KnowledgeNodeDocument[]> {
    if (refIds.length === 0) return [];
    return this.nodeModel.find({ kind, refId: { $in: refIds } }).exec();
  }

  /**
   * Make `to` the **complete** set of outbound edges of this type from `from`:
   * missing ones are added, ones not listed are deleted.
   *
   * Upserting alone is not enough for a derived graph. If a lesson loses an item,
   * an upsert-only rebuild leaves the old `contains` edge behind and the graph
   * goes on asserting a containment that no longer exists — which is the same
   * class of untruth ADR-005 exists to remove, arriving by a different route.
   * Being able to say "these are now exactly the edges" is what makes the graph
   * a function of the content rather than of every content edit ever made.
   */
  async setEdgesFrom(
    from: Types.ObjectId,
    type: EdgeType,
    to: Types.ObjectId[],
  ): Promise<void> {
    await this.edgeModel.deleteMany({ from, type, to: { $nin: to } }).exec();
    if (to.length === 0) return;

    await this.edgeModel.bulkWrite(
      to.map((target) => ({
        updateOne: {
          filter: { from, to: target, type },
          update: { $setOnInsert: { from, to: target, type } },
          upsert: true,
        },
      })),
    );
  }

  /**
   * The inbound mirror of `setEdgesFrom`: make `from` the complete set of edges
   * of this type *pointing at* `to`.
   *
   * Both directions exist because `prerequisite` runs prerequisite → dependent,
   * so "this lesson's prerequisites are exactly these" is a statement about
   * inbound edges, while "this lesson contains exactly these items" is outbound.
   * Collapsing them into one method with a direction flag would read worse at
   * both call sites.
   */
  async setEdgesTo(
    to: Types.ObjectId,
    type: EdgeType,
    from: Types.ObjectId[],
  ): Promise<void> {
    await this.edgeModel.deleteMany({ to, type, from: { $nin: from } }).exec();
    if (from.length === 0) return;

    await this.edgeModel.bulkWrite(
      from.map((source) => ({
        updateOne: {
          filter: { from: source, to, type },
          update: { $setOnInsert: { from: source, to, type } },
          upsert: true,
        },
      })),
    );
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
