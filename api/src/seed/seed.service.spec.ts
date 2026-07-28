import { SeedService } from './seed.service';
import { ContentService } from '../content/content.service';
import { KnowledgeGraphService } from '../knowledge-graph/knowledge-graph.service';
import { Types } from 'mongoose';

const LESSON_ONE = new Types.ObjectId('60000000000000000000ce01');
const LESSON_TWO = new Types.ObjectId('60000000000000000000ce02');
const ITEM_ONE = new Types.ObjectId('60000000000000000000da01');
const ITEM_TWO = new Types.ObjectId('60000000000000000000da02');

describe('SeedService & Knowledge Graph (OPEN-ITEMS #9, #10)', () => {
  let seedService: SeedService;
  let contentService: {
    upsertKana: jest.Mock;
    setKanaConceptId: jest.Mock;
    upsertVocab: jest.Mock;
    setVocabConceptId: jest.Mock;
    upsertGrammar: jest.Mock;
    setGrammarConceptId: jest.Mock;
    upsertKanji: jest.Mock;
    setKanjiConceptId: jest.Mock;
    upsertLesson: jest.Mock;
    countKana: jest.Mock;
    countVocab: jest.Mock;
    countGrammar: jest.Mock;
    countKanji: jest.Mock;
    countLessons: jest.Mock;
    findLessonsForGraph: jest.Mock;
  };
  let knowledgeGraph: {
    upsertNode: jest.Mock;
    upsertEdge: jest.Mock;
    findNodeByRef: jest.Mock;
    findNodesByRefs: jest.Mock;
    setEdgesFrom: jest.Mock;
    setEdgesTo: jest.Mock;
    countNodes: jest.Mock;
    countEdges: jest.Mock;
  };

  beforeEach(() => {
    let dummyIdCounter = 1;
    const generateOid = () => new Types.ObjectId((dummyIdCounter++).toString(16).padStart(24, '0'));

    contentService = {
      upsertKana: jest.fn().mockImplementation(() => Promise.resolve({ _id: generateOid() })),
      setKanaConceptId: jest.fn().mockResolvedValue(undefined),
      upsertVocab: jest.fn().mockImplementation(() => Promise.resolve({ _id: generateOid() })),
      setVocabConceptId: jest.fn().mockResolvedValue(undefined),
      upsertGrammar: jest.fn().mockImplementation(() => Promise.resolve({ _id: generateOid() })),
      setGrammarConceptId: jest.fn().mockResolvedValue(undefined),
      upsertKanji: jest.fn().mockImplementation(() => Promise.resolve({ _id: generateOid() })),
      setKanjiConceptId: jest.fn().mockResolvedValue(undefined),
      upsertLesson: jest.fn().mockImplementation(() => Promise.resolve({ _id: generateOid() })),
      countKana: jest.fn().mockResolvedValue(208),
      countVocab: jest.fn().mockResolvedValue(800),
      countGrammar: jest.fn().mockResolvedValue(40),
      countKanji: jest.fn().mockResolvedValue(104),
      countLessons: jest.fn().mockResolvedValue(60),
      // Two lessons, the second depending on the first, with one item each —
      // the smallest shape that exercises both edge directions of the graph
      // sync (ADR-005).
      findLessonsForGraph: jest.fn().mockImplementation(() =>
        Promise.resolve([
          {
            id: LESSON_ONE,
            title: 'Lesson one',
            itemRefs: [{ kind: 'kana', id: ITEM_ONE }],
            prerequisiteLessonIds: [],
          },
          {
            id: LESSON_TWO,
            title: 'Lesson two',
            itemRefs: [{ kind: 'vocab', id: ITEM_TWO }],
            prerequisiteLessonIds: [LESSON_ONE],
          },
        ]),
      ),
    };

    knowledgeGraph = {
      upsertNode: jest.fn().mockImplementation(() => Promise.resolve({ _id: generateOid() })),
      upsertEdge: jest.fn().mockResolvedValue(undefined),
      findNodeByRef: jest.fn().mockImplementation(() => Promise.resolve({ _id: generateOid() })),
      // Echoes a node back per requested ref, so the sync can map ref -> node.
      findNodesByRefs: jest
        .fn()
        .mockImplementation((_kind: string, refIds: Types.ObjectId[]) =>
          Promise.resolve(refIds.map((refId) => ({ _id: generateOid(), refId }))),
        ),
      setEdgesFrom: jest.fn().mockResolvedValue(undefined),
      setEdgesTo: jest.fn().mockResolvedValue(undefined),
      countNodes: jest.fn().mockResolvedValue(1150),
      countEdges: jest.fn().mockResolvedValue(400),
    };

    seedService = new SeedService(
      contentService as unknown as ContentService,
      knowledgeGraph as unknown as KnowledgeGraphService,
    );
  });

  it('runs the seed workflow successfully and generates lesson knowledge graph nodes', async () => {
    const summary = await seedService.run();

    expect(summary.kanaItems).toBeGreaterThan(0);
    expect(summary.lessons).toBeGreaterThan(0);

    // OPEN-ITEMS #9: verifies lesson nodes were created in KnowledgeGraph
    const lessonNodeCalls = knowledgeGraph.upsertNode.mock.calls.filter(
      (call: [{ kind: string }]) => call[0].kind === 'lesson',
    );
    expect(lessonNodeCalls.length).toBeGreaterThan(0);
  });

  /**
   * ADR-005. The old per-pack code built lesson nodes for kana only, so the live
   * graph held 22 nodes for 90 lessons and `contains` edges for one kind of item.
   * The sync derives the layer from whatever lessons exist, so the assertion that
   * matters is **every** lesson gets a node — not "at least one".
   */
  describe('lesson graph sync (ADR-005)', () => {
    it('creates a lesson node for every lesson the content has, not just kana', async () => {
      await seedService.run();

      const refIds = knowledgeGraph.upsertNode.mock.calls
        .filter((call: [{ kind: string }]) => call[0].kind === 'lesson')
        .map((call: [{ refId: Types.ObjectId }]) => call[0].refId.toString());

      expect(refIds).toEqual([LESSON_ONE.toString(), LESSON_TWO.toString()]);
    });

    it('declares the complete containment of each lesson, so a dropped item is removed', async () => {
      await seedService.run();

      // setEdgesFrom, not upsertEdge: the sync must be able to remove an edge
      // for an item a lesson no longer has.
      expect(knowledgeGraph.setEdgesFrom).toHaveBeenCalledTimes(2);
      for (const call of knowledgeGraph.setEdgesFrom.mock.calls) {
        expect(call[1]).toBe('contains');
        expect(call[2]).toHaveLength(1);
      }
      expect(knowledgeGraph.upsertEdge).not.toHaveBeenCalled();
    });

    it('reads prerequisites off the lesson documents rather than re-deriving a chain', async () => {
      await seedService.run();

      expect(knowledgeGraph.setEdgesTo).toHaveBeenCalledTimes(2);
      const [firstLesson, secondLesson] = knowledgeGraph.setEdgesTo.mock.calls as [
        [Types.ObjectId, string, Types.ObjectId[]],
        [Types.ObjectId, string, Types.ObjectId[]],
      ];

      // Lesson one has no prerequisites, and is still declared — that empty
      // declaration is what clears a prerequisite that was removed.
      expect(firstLesson[1]).toBe('prerequisite');
      expect(firstLesson[2]).toEqual([]);

      // Lesson two's single prerequisite resolves to lesson one's *node*.
      expect(secondLesson[1]).toBe('prerequisite');
      expect(secondLesson[2]).toHaveLength(1);
      expect(secondLesson[2][0].toString()).toBe(firstLesson[0].toString());
    });

    it('batches item node lookups by kind instead of one query per item', async () => {
      await seedService.run();

      // Two kinds across the two lessons: one call each, never one per item.
      const kinds = knowledgeGraph.findNodesByRefs.mock.calls.map(
        (call: [string, Types.ObjectId[]]) => call[0],
      );
      expect(kinds.sort()).toEqual(['kana', 'vocab']);
    });
  });

  it('is idempotent: running seed twice invokes the exact same upserts without duplication (OPEN-ITEMS #10)', async () => {
    const firstRun = await seedService.run();
    const firstCallsCount = contentService.upsertKana.mock.calls.length;

    const secondRun = await seedService.run();
    const secondCallsCount = contentService.upsertKana.mock.calls.length;

    expect(secondRun).toEqual(firstRun);
    // Exact double invocation of upsert operations on natural keys
    expect(secondCallsCount).toBe(firstCallsCount * 2);
  });
});
