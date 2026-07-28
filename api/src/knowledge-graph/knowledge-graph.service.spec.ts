import { Types } from 'mongoose';
import { KnowledgeGraphService } from './knowledge-graph.service';

const NODE_A = new Types.ObjectId('60000000000000000000aa01');
const NODE_B = new Types.ObjectId('60000000000000000000bb01');
const NODE_C = new Types.ObjectId('60000000000000000000cc01');

/**
 * Covers the two primitives ADR-005 added, and only those. What is worth pinning
 * is that they **declare a complete set** rather than merely adding: a derived
 * graph that can only grow keeps asserting containments and dependencies that the
 * content dropped, which is the same kind of untruth ADR-005 exists to remove.
 */
describe('KnowledgeGraphService edge sets (ADR-005)', () => {
  function makeService() {
    const deleteMany = jest.fn((_filter: Record<string, unknown>) => ({
      exec: () => Promise.resolve({ deletedCount: 0 }),
    }));
    const bulkWrite = jest.fn((_ops: unknown[]) => Promise.resolve({}));
    const find = jest.fn((_filter: Record<string, unknown>) => ({
      exec: () => Promise.resolve([]),
    }));

    const service = new KnowledgeGraphService(
      { find } as never,
      { deleteMany, bulkWrite } as never,
    );

    return { service, deleteMany, bulkWrite, find };
  }

  describe('setEdgesFrom', () => {
    it('deletes outbound edges of that type whose target is not in the new set', async () => {
      const { service, deleteMany } = makeService();

      await service.setEdgesFrom(NODE_A, 'contains', [NODE_B]);

      expect(deleteMany).toHaveBeenCalledTimes(1);
      expect(deleteMany.mock.calls[0][0]).toEqual({
        from: NODE_A,
        type: 'contains',
        to: { $nin: [NODE_B] },
      });
    });

    it('upserts each edge, so an existing one is left alone rather than duplicated', async () => {
      const { service, bulkWrite } = makeService();

      await service.setEdgesFrom(NODE_A, 'contains', [NODE_B, NODE_C]);

      const ops = bulkWrite.mock.calls[0][0] as {
        updateOne: { filter: unknown; update: unknown; upsert: boolean };
      }[];
      expect(ops).toHaveLength(2);
      expect(ops[0].updateOne.upsert).toBe(true);
      expect(ops[0].updateOne.filter).toEqual({ from: NODE_A, to: NODE_B, type: 'contains' });
      // $setOnInsert, not $set: an edge carries no mutable state, and touching an
      // existing row would bump `updatedAt` on every seed for no reason.
      expect(ops[0].updateOne.update).toEqual({
        $setOnInsert: { from: NODE_A, to: NODE_B, type: 'contains' },
      });
    });

    /**
     * The case that makes an empty set meaningful: a lesson emptied of items must
     * end up with no `contains` edges, so the delete still has to run.
     */
    it('clears every edge when the new set is empty, and writes nothing', async () => {
      const { service, deleteMany, bulkWrite } = makeService();

      await service.setEdgesFrom(NODE_A, 'contains', []);

      expect(deleteMany.mock.calls[0][0]).toEqual({
        from: NODE_A,
        type: 'contains',
        to: { $nin: [] },
      });
      expect(bulkWrite).not.toHaveBeenCalled();
    });

    it('only touches the given edge type, leaving other relations between the same nodes', async () => {
      const { service, deleteMany } = makeService();

      await service.setEdgesFrom(NODE_A, 'related', [NODE_B]);

      expect(deleteMany.mock.calls[0][0]).toMatchObject({ type: 'related' });
    });
  });

  describe('setEdgesTo', () => {
    /**
     * `prerequisite` runs prerequisite → dependent, so "this lesson's
     * prerequisites are exactly these" is a statement about *inbound* edges. If
     * this mirrored `setEdgesFrom` by mistake it would silently rewrite the
     * dependents of a lesson instead of its prerequisites.
     */
    it('deletes inbound edges of that type whose source is not in the new set', async () => {
      const { service, deleteMany } = makeService();

      await service.setEdgesTo(NODE_C, 'prerequisite', [NODE_A]);

      expect(deleteMany.mock.calls[0][0]).toEqual({
        to: NODE_C,
        type: 'prerequisite',
        from: { $nin: [NODE_A] },
      });
    });

    it('writes each edge pointing at the target, not away from it', async () => {
      const { service, bulkWrite } = makeService();

      await service.setEdgesTo(NODE_C, 'prerequisite', [NODE_A, NODE_B]);

      const ops = bulkWrite.mock.calls[0][0] as { updateOne: { filter: unknown } }[];
      expect(ops).toHaveLength(2);
      expect(ops[0].updateOne.filter).toEqual({
        from: NODE_A,
        to: NODE_C,
        type: 'prerequisite',
      });
    });

    it('clears every inbound edge when the new set is empty', async () => {
      const { service, deleteMany, bulkWrite } = makeService();

      await service.setEdgesTo(NODE_C, 'prerequisite', []);

      expect(deleteMany).toHaveBeenCalledTimes(1);
      expect(bulkWrite).not.toHaveBeenCalled();
    });
  });

  describe('findNodesByRefs', () => {
    it('queries once for the whole batch, scoped to the kind', async () => {
      const { service, find } = makeService();

      await service.findNodesByRefs('kana', [NODE_A, NODE_B]);

      expect(find).toHaveBeenCalledTimes(1);
      expect(find.mock.calls[0][0]).toEqual({
        kind: 'kana',
        refId: { $in: [NODE_A, NODE_B] },
      });
    });

    /**
     * `{ $in: [] }` matches nothing, so querying would be harmless but pointless
     * — and the sync calls this per kind, including kinds no lesson uses.
     */
    it('does not query at all for an empty batch', async () => {
      const { service, find } = makeService();

      await expect(service.findNodesByRefs('grammar', [])).resolves.toEqual([]);
      expect(find).not.toHaveBeenCalled();
    });
  });
});
