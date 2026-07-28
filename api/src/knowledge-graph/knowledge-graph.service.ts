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

  /**
   * Idempotent upsert of a `concept` node — an idea with no content document
   * behind it (ADR-005 / §5.3), identified by its `slug`.
   *
   * Deliberately a separate method from `upsertNode` rather than a wider `kind`
   * on it: the two have different identities (`{kind, refId}` versus
   * `{lang, slug}`), and one method taking "either an id or a slug" would let a
   * caller pass neither. **`refId` is never written here**, and must stay absent
   * rather than null — the partial unique index treats an explicit null as a
   * value, so a stored null would collide with the next concept.
   */
  async upsertConcept(input: { slug: string; label: string }): Promise<KnowledgeNodeDocument> {
    return this.nodeModel
      .findOneAndUpdate(
        { lang: 'ja', slug: input.slug },
        { $set: { label: input.label, kind: 'concept', lang: 'ja' } },
        { new: true, upsert: true },
      )
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

  /**
   * Delete every edge of these types. Seed support only, and it exists for a
   * failure that per-node declaration cannot reach.
   *
   * `setEdgesFrom` / `setEdgesTo` state the complete set of edges *for a node they
   * are called about*. Edges written by an **earlier scheme**, between nodes the
   * current scheme never mentions, are invisible to that: the graph once linked
   * every character in a lesson to every character in the next, 1614 kana→kana
   * `prerequisite` edges asserting things like "ぴょ requires りょ" (ADR-005,
   * OPEN-ITEMS #9). Rebuilding the lesson layer does not remove one of them,
   * because no lesson node appears at either end.
   *
   * So the seed clears the derived types and rebuilds them. That also disposes of
   * edges orphaned by a deleted node, which nothing else prunes.
   *
   * Only safe for **wholly derived** types, and the caller must rewrite them in
   * the same run. `related` is deliberately not cleared by the seed: nothing
   * creates it, so anything found there was put there by hand.
   */
  async clearEdgesOfTypes(types: EdgeType[]): Promise<number> {
    const result = await this.edgeModel.deleteMany({ type: { $in: types } }).exec();
    return result.deletedCount ?? 0;
  }

  /**
   * Bring the collections' indexes in line with the schema, dropping any that the
   * schema no longer declares. Seed support only.
   *
   * Needed because ADR-005 replaced the plain unique `{kind, refId}` index with a
   * **partial** one — a concept has no `refId`, and under the old index the second
   * concept ever created would collide with the first on a missing value. Mongo
   * cannot redefine an index's options in place, so the old one has to go, and
   * Mongoose only ever *adds* indexes on its own.
   *
   * This is safe here in a way it would not be on a user collection: both
   * collections are **wholly derived** from content and rebuilt by the seed, so
   * the worst case of a dropped index is a slow query until it is recreated a
   * moment later. It is still index surgery — it belongs in the seed, which is
   * already the thing that rewrites this data, and nowhere near a request path.
   */
  async syncIndexes(): Promise<void> {
    await this.nodeModel.syncIndexes();
    await this.edgeModel.syncIndexes();
  }

  /** Seed support only — never call this from a request path. */
  async clear(): Promise<void> {
    await Promise.all([this.nodeModel.deleteMany({}).exec(), this.edgeModel.deleteMany({}).exec()]);
  }
}
