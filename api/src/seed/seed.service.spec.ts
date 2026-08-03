import { SeedService } from './seed.service';
import { ContentService } from '../content/content.service';
import { KnowledgeGraphService } from '../knowledge-graph/knowledge-graph.service';
import { Types } from 'mongoose';

const LESSON_ONE = new Types.ObjectId('60000000000000000000ce01');
const LESSON_TWO = new Types.ObjectId('60000000000000000000ce02');
const ITEM_ONE = new Types.ObjectId('60000000000000000000da01');
const ITEM_TWO = new Types.ObjectId('60000000000000000000da02');
const KANA_HA = new Types.ObjectId('60000000000000000000fa01');
const GRAMMAR_HA = new Types.ObjectId('60000000000000000000fb01');
const VOCAB_YAMA = new Types.ObjectId('60000000000000000000fc01');
const KANJI_YAMA = new Types.ObjectId('60000000000000000000fd01');

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
    // Phase 0 — Data foundation: stamped on each lesson's kana by the kana
    // seed pass so the public curriculum endpoint can resolve "taught in
    // lesson N" without joining through `itemRefs`. The migration covers
    // pre-existing databases; this keeps fresh and repeated seeds correct.
    setKanaTaughtInLesson: jest.Mock;
    countKana: jest.Mock;
    countVocab: jest.Mock;
    countGrammar: jest.Mock;
    countKanji: jest.Mock;
    countLessons: jest.Mock;
    findLessonsForGraph: jest.Mock;
    findKanaForGraph: jest.Mock;
    findGrammarForGraph: jest.Mock;
    findVocabForGraph: jest.Mock;
    findKanjiForGraph: jest.Mock;
  };
  let knowledgeGraph: {
    upsertNode: jest.Mock;
    upsertConcept: jest.Mock;
    upsertEdge: jest.Mock;
    findNodeByRef: jest.Mock;
    findNodesByRefs: jest.Mock;
    setEdgesFrom: jest.Mock;
    setEdgesTo: jest.Mock;
    clearEdgesOfTypes: jest.Mock;
    syncIndexes: jest.Mock;
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
      // Phase 0 — Data foundation: stamped on each lesson's kana by the kana
      // seed pass so the public curriculum endpoint can resolve "taught in
      // lesson N" without joining through `itemRefs`. The migration covers
      // pre-existing databases; this keeps fresh and repeated seeds correct.
      setKanaTaughtInLesson: jest.fn().mockResolvedValue(undefined),
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
      // The concept pass resolves characters and grammar titles to ids after all
      // content is seeded, so these are the lookups it uses. One kana that a
      // contrast pair actually names (は), and the grammar point it contrasts with,
      // so the glyph-vs-role pair resolves in the test too.
      findKanaForGraph: jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve([{ id: KANA_HA, kana: 'は', script: 'hiragana' }]),
        ),
      findGrammarForGraph: jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve([{ id: GRAMMAR_HA, title: 'は — topic marker' }]),
        ),
      // A **kana** lemma, because that is how this course stores vocabulary: the
      // kanji unit re-reads words already known, so 山's association with やま
      // comes from the authored `writes` field, not from scanning the lemma.
      findVocabForGraph: jest
        .fn()
        .mockImplementation(() => Promise.resolve([{ id: VOCAB_YAMA, lemma: 'やま' }])),
      findKanjiForGraph: jest
        .fn()
        .mockImplementation(() => Promise.resolve([{ id: KANJI_YAMA, char: '山' }])),
    };

    knowledgeGraph = {
      upsertNode: jest.fn().mockImplementation(() => Promise.resolve({ _id: generateOid() })),
      upsertConcept: jest.fn().mockImplementation(() => Promise.resolve({ _id: generateOid() })),
      upsertEdge: jest.fn().mockResolvedValue(undefined),
      syncIndexes: jest.fn().mockResolvedValue(undefined),
      clearEdgesOfTypes: jest.fn().mockResolvedValue(0),
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
  /**
   * The node ids the lesson pass created, paired from `upsertNode`'s calls and
   * their resolved values — needed because the concept pass writes `contains`
   * edges too, so a bare call count no longer identifies the lesson layer.
   */
  async function lessonNodeIds(): Promise<string[]> {
    const ids: string[] = [];
    const calls = knowledgeGraph.upsertNode.mock.calls as [{ kind: string }][];

    for (const [index, call] of calls.entries()) {
      if (call[0].kind !== 'lesson') continue;
      const node = (await knowledgeGraph.upsertNode.mock.results[index].value) as {
        _id: Types.ObjectId;
      };
      ids.push(node._id.toString());
    }

    return ids;
  }

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

      // Filtered to the lesson nodes: the concept pass also declares `contains`
      // edges, from concept nodes to their member kana.
      const lessonNodes = await lessonNodeIds();
      const lessonContains = knowledgeGraph.setEdgesFrom.mock.calls.filter(
        (call: [Types.ObjectId, string, Types.ObjectId[]]) =>
          call[1] === 'contains' && lessonNodes.includes(call[0].toString()),
      );

      // setEdgesFrom, not upsertEdge: the sync must be able to remove an edge
      // for an item a lesson no longer has.
      expect(lessonContains).toHaveLength(2);
      for (const call of lessonContains) {
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

    it('batches item node lookups instead of querying once per item', async () => {
      await seedService.run();

      const calls = knowledgeGraph.findNodesByRefs.mock.calls as [string, Types.ObjectId[]][];
      const callsContaining = (id: Types.ObjectId) =>
        calls.filter(([, refIds]) => refIds.some((refId) => refId.equals(id))).length;

      // Each item is resolved exactly once, in a batch — never re-queried.
      expect(callsContaining(ITEM_ONE)).toBe(1);
      expect(callsContaining(ITEM_TWO)).toBe(1);

      // And the call count is bounded by the number of kinds and passes (lesson
      // items, concepts, usesKanji), not by how many items exist.
      expect(calls.length).toBeLessThanOrEqual(6);
      for (const [, refIds] of calls) {
        expect(Array.isArray(refIds)).toBe(true);
      }
    });
  });

  /**
   * The §5.3 layer: concepts that are ideas rather than documents, and the
   * authored contrast pairs. `concepts.spec.ts` gates the data; these pin how the
   * seed writes it.
   */
  describe('concept graph sync (ADR-005)', () => {
    it('syncs indexes before writing concepts, since the old unique index rejects the second one', async () => {
      await seedService.run();

      expect(knowledgeGraph.syncIndexes).toHaveBeenCalledTimes(1);
      const syncOrder = knowledgeGraph.syncIndexes.mock.invocationCallOrder[0];
      const firstConcept = knowledgeGraph.upsertConcept.mock.invocationCallOrder[0];
      expect(syncOrder).toBeLessThan(firstConcept);
    });

    it('creates a concept per kana row, keyed by slug rather than a content id', async () => {
      await seedService.run();

      const slugs = knowledgeGraph.upsertConcept.mock.calls.map(
        (call: [{ slug: string }]) => call[0].slug,
      );

      // Derived from the packs, so this grows with the content rather than being
      // a fixed list — what matters is the shape and that they are unique.
      expect(slugs.length).toBeGreaterThan(20);
      expect(new Set(slugs).size).toBe(slugs.length);
      expect(slugs).toContain('row-hiragana-a');
      expect(slugs).toContain('row-katakana-a');
      // A concept never claims a refId — the partial unique index depends on it
      // staying absent.
      for (const call of knowledgeGraph.upsertConcept.mock.calls as [
        Record<string, unknown>,
      ][]) {
        expect(call[0].refId).toBeUndefined();
      }
    });

    /**
     * Symmetric relation, directed storage. The pair authored as は ~ は-topic-marker
     * must be readable from either end with one indexed lookup, which means two
     * edges.
     */
    it('writes contrasts in both directions', async () => {
      await seedService.run();

      const contrastCalls = knowledgeGraph.setEdgesFrom.mock.calls.filter(
        (call: [Types.ObjectId, string, Types.ObjectId[]]) => call[1] === 'contrasts-with',
      );

      // The stubbed content resolves exactly one pair (は kana ~ は topic marker),
      // so both of its endpoints declare an edge.
      expect(contrastCalls).toHaveLength(2);
      const [first, second] = contrastCalls as [
        [Types.ObjectId, string, Types.ObjectId[]],
        [Types.ObjectId, string, Types.ObjectId[]],
      ];
      expect(first[2][0].toString()).toBe(second[0].toString());
      expect(second[2][0].toString()).toBe(first[0].toString());
    });

    /**
     * Derived from `KanjiSeed.writes` in the real kanji pack, not from the lemma.
     * Scanning lemmas for kanji characters finds nothing in this course — tried
     * it, zero edges across 802 words — because vocabulary is stored in kana.
     */
    it('links a word to the kanji that writes it', async () => {
      await seedService.run();

      const usesKanji = knowledgeGraph.setEdgesFrom.mock.calls.filter(
        (call: [Types.ObjectId, string, Types.ObjectId[]]) => call[1] === 'usesKanji',
      );

      // 山 declares `writes: ['やま']`, which is the stubbed vocabulary lemma.
      expect(usesKanji).toHaveLength(1);
      expect(usesKanji[0][2]).toHaveLength(1);
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
