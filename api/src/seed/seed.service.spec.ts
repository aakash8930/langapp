import { SeedService } from './seed.service';
import { ContentService } from '../content/content.service';
import { KnowledgeGraphService } from '../knowledge-graph/knowledge-graph.service';
import { Types } from 'mongoose';

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
  };
  let knowledgeGraph: {
    upsertNode: jest.Mock;
    upsertEdge: jest.Mock;
    findNodeByRef: jest.Mock;
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
    };

    knowledgeGraph = {
      upsertNode: jest.fn().mockImplementation(() => Promise.resolve({ _id: generateOid() })),
      upsertEdge: jest.fn().mockResolvedValue(undefined),
      findNodeByRef: jest.fn().mockImplementation(() => Promise.resolve({ _id: generateOid() })),
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
