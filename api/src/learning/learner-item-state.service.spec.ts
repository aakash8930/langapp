import { Types } from 'mongoose';
import { ContentKind } from '../knowledge-graph/schemas/knowledge-node.schema';
import { LearnerItemStateService } from './learner-item-state.service';
import { SourceContext } from './schemas/learner-item-state.schema';

const USER = new Types.ObjectId('607f1f77bcf86cd799439011');
const ITEM_A = new Types.ObjectId('507f1f77bcf86cd7994390a1');

describe('LearnerItemStateService.record (ADR-003 write path)', () => {
  interface StateStub {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    itemRef: { kind: ContentKind; id: Types.ObjectId };
    exposures: number;
    correct: number;
    incorrect: number;
    responseTimeMs: { count: number; mean: number; m2: number };
    lastNOutcomes: boolean[];
    byExerciseType: Map<string, { seen: number; correct: number }>;
    confidence: number;
    masteryLevel: 'new' | 'learning' | 'familiar' | 'mastered';
    firstSeenAt: Date | null;
    lastSeenAt: Date | null;
    sourceContexts: SourceContext[];
  }

  function makeRecordService(existing: StateStub[] = []) {
    const created: StateStub[] = [];
    const updated: { _id: Types.ObjectId; doc: Record<string, unknown> }[] = [];

    const stateModel = {
      findOne: jest.fn((filter: Record<string, unknown>) => ({
        exec: () => {
          const match = existing.find(
            (s) =>
              s.userId.toString() === (filter['userId'] as Types.ObjectId).toString() &&
              s.itemRef.kind === filter['itemRef.kind'] &&
              s.itemRef.id.toString() ===
                (filter['itemRef.id'] as Types.ObjectId).toString(),
          );
          return Promise.resolve(match ?? null);
        },
      })),
      create: jest.fn((doc: Record<string, unknown>) => {
        // `create` on a duplicate-key code path is the failure the slice
        // tolerates; the stub does not need to throw because the test that
        // exercises it asserts nothing about create's call count.
        const row = {
          _id: new Types.ObjectId(),
          userId: doc['userId'] as Types.ObjectId,
          itemRef: doc['itemRef'] as StateStub['itemRef'],
          exposures: doc['exposures'] as number,
          correct: doc['correct'] as number,
          incorrect: doc['incorrect'] as number,
          responseTimeMs: doc['responseTimeMs'] as StateStub['responseTimeMs'],
          lastNOutcomes: doc['lastNOutcomes'] as boolean[],
          byExerciseType: doc['byExerciseType'] as StateStub['byExerciseType'],
          confidence: doc['confidence'] as number,
          masteryLevel: doc['masteryLevel'] as StateStub['masteryLevel'],
          firstSeenAt: doc['firstSeenAt'] as Date,
          lastSeenAt: doc['lastSeenAt'] as Date,
          sourceContexts: doc['sourceContexts'] as SourceContext[],
        };
        created.push(row);
        return Promise.resolve(row);
      }),
      updateOne: jest.fn(
        (filter: { _id: Types.ObjectId }, update: { $set: Record<string, unknown> }) => {
          updated.push({ _id: filter._id, doc: update.$set });
          const row = existing.find((s) => s._id.toString() === filter._id.toString());
          if (row) {
            Object.assign(row, update.$set);
            // Map fields come back as Maps from the service — re-instantiate.
            if (update.$set['byExerciseType'] instanceof Map) {
              row.byExerciseType = new Map(update.$set['byExerciseType'] as Map<string, { seen: number; correct: number }>);
            }
          }
          return { exec: () => Promise.resolve({ acknowledged: true }) };
        },
      ),
    };

    const service = new LearnerItemStateService(stateModel as never);
    return { service, stateModel, created, updated, existing };
  }

  const baseInput = {
    userId: USER,
    itemRef: { kind: 'kana' as ContentKind, id: ITEM_A },
  };

  it('creates a fresh state on first exposure with derived confidence and mastery', async () => {
    const { service, created } = makeRecordService();

    await service.record({
      ...baseInput,
      outcome: { correct: true, responseTimeMs: 1200 },
      exerciseType: 'multipleChoice',
      sourceContext: 'lesson',
    });

    expect(created).toHaveLength(1);
    const state = created[0];
    expect(state.exposures).toBe(1);
    expect(state.correct).toBe(1);
    expect(state.incorrect).toBe(0);
    expect(state.lastNOutcomes).toEqual([true]);
    expect(state.responseTimeMs.count).toBe(1);
    expect(state.responseTimeMs.mean).toBe(1200);
    expect(state.byExerciseType.get('multipleChoice')).toEqual({ seen: 1, correct: 1 });
    expect(state.sourceContexts).toEqual(['lesson']);
    // First exposure with full evidence cannot yet be 'mastered' (needs
    // EXPOSURES_FOR_FULL_EVIDENCE = 5); 'learning' is the band a single
    // correct sample lands in.
    expect(state.masteryLevel).toBe('learning');
  });

  it('updates an existing state: bumps counters, pushes the ring, preserves firstSeenAt', async () => {
    const initial: StateStub = {
      _id: new Types.ObjectId(),
      userId: USER,
      itemRef: { kind: 'kana', id: ITEM_A },
      exposures: 1,
      correct: 1,
      incorrect: 0,
      responseTimeMs: { count: 1, mean: 1200, m2: 0 },
      lastNOutcomes: [true],
      byExerciseType: new Map([['multipleChoice', { seen: 1, correct: 1 }]]),
      confidence: 0.6,
      masteryLevel: 'learning',
      firstSeenAt: new Date('2026-07-01T00:00:00Z'),
      lastSeenAt: new Date('2026-07-01T00:00:00Z'),
      sourceContexts: ['lesson'],
    };
    const { service, updated } = makeRecordService([initial]);

    await service.record({
      ...baseInput,
      outcome: { correct: false, responseTimeMs: 1500 },
      exerciseType: 'multipleChoice',
      sourceContext: 'lesson',
    });

    expect(updated).toHaveLength(1);
    const set = updated[0].doc;
    expect(set['exposures']).toBe(2);
    expect(set['correct']).toBe(1);
    expect(set['incorrect']).toBe(1);
    expect(set['lastNOutcomes']).toEqual([true, false]);
    expect(set['firstSeenAt']).toEqual(new Date('2026-07-01T00:00:00Z'));
    expect((set['byExerciseType'] as Map<string, { seen: number; correct: number }>).get('multipleChoice')).toEqual({
      seen: 2,
      correct: 1,
    });
  });

  it('never touches byExerciseType when exerciseType is null (chat)', async () => {
    // Decision (2): chat contexts add to totals / ring / response
    // time but leave the per-type map untouched. The map stays a
    // recognition-vs-recall metric for exercises.
    const initial: StateStub = {
      _id: new Types.ObjectId(),
      userId: USER,
      itemRef: { kind: 'vocab', id: ITEM_A },
      exposures: 0,
      correct: 0,
      incorrect: 0,
      responseTimeMs: { count: 0, mean: 0, m2: 0 },
      lastNOutcomes: [],
      byExerciseType: new Map(),
      confidence: 0,
      masteryLevel: 'new',
      firstSeenAt: null,
      lastSeenAt: null,
      sourceContexts: [],
    };
    const { service, updated } = makeRecordService([initial]);

    await service.record({
      ...baseInput,
      itemRef: { kind: 'vocab', id: ITEM_A },
      outcome: { correct: false },
      exerciseType: null,
      sourceContext: 'chat',
    });

    expect(updated).toHaveLength(1);
    const map = updated[0].doc['byExerciseType'] as Map<string, { seen: number; correct: number }>;
    expect(map.size).toBe(0);
  });

  it('deduplicates sourceContexts on repeated updates', async () => {
    const initial: StateStub = {
      _id: new Types.ObjectId(),
      userId: USER,
      itemRef: { kind: 'kana', id: ITEM_A },
      exposures: 1,
      correct: 1,
      incorrect: 0,
      responseTimeMs: { count: 0, mean: 0, m2: 0 },
      lastNOutcomes: [true],
      byExerciseType: new Map([['multipleChoice', { seen: 1, correct: 1 }]]),
      confidence: 0.6,
      masteryLevel: 'learning',
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      sourceContexts: ['lesson'],
    };
    const { service, updated } = makeRecordService([initial]);

    await service.record({
      ...baseInput,
      outcome: { correct: true },
      exerciseType: 'multipleChoice',
      sourceContext: 'lesson',
    });

    expect(updated[0].doc['sourceContexts']).toEqual(['lesson']);
  });

  it('appends a new sourceContext without losing prior provenance', async () => {
    const initial: StateStub = {
      _id: new Types.ObjectId(),
      userId: USER,
      itemRef: { kind: 'vocab', id: ITEM_A },
      exposures: 1,
      correct: 1,
      incorrect: 0,
      responseTimeMs: { count: 0, mean: 0, m2: 0 },
      lastNOutcomes: [true],
      byExerciseType: new Map(),
      confidence: 0.6,
      masteryLevel: 'learning',
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      sourceContexts: ['lesson'],
    };
    const { service, updated } = makeRecordService([initial]);

    await service.record({
      ...baseInput,
      itemRef: { kind: 'vocab', id: ITEM_A },
      outcome: { correct: false },
      exerciseType: null,
      sourceContext: 'chat',
    });

    // Order matters here: a learner who first saw this in a lesson and is
    // now seeing a chat correction has both, in that order.
    expect(updated[0].doc['sourceContexts']).toEqual(['lesson', 'chat']);
  });

  it('swallows an underlying error and never throws (the never-throws contract)', async () => {
    const stateModel = {
      findOne: () => ({
        exec: () => Promise.reject(new Error('mongo down')),
      }),
      create: jest.fn(() => Promise.resolve({})),
      updateOne: jest.fn(() => ({ exec: () => Promise.resolve({}) })),
    };
    const service = new LearnerItemStateService(stateModel as never);

    // Resolves, not rejects — every caller is on a side-effect path.
    await expect(
      service.record({
        ...baseInput,
        outcome: { correct: true },
        exerciseType: 'multipleChoice',
        sourceContext: 'lesson',
      }),
    ).resolves.toBeUndefined();
  });

  it('lets an update ride on a duplicate-key insert without double-counting', async () => {
    // The slice's idempotency guarantee: two concurrent record() calls for the
    // same (user, item) cannot split evidence across two rows. The first
    // creates; the second's insert would fail with code 11000 and is
    // intentionally swallowed — the winner owns the row.
    const stateModel = {
      findOne: jest.fn(() => ({ exec: () => Promise.resolve(null) })),
      create: jest.fn(() => {
        const err = new Error('E11000 duplicate key') as Error & { code: number };
        err.code = 11000;
        return Promise.reject(err);
      }),
      updateOne: jest.fn(() => ({ exec: () => Promise.resolve({}) })),
    };
    const service = new LearnerItemStateService(stateModel as never);

    await expect(
      service.record({
        ...baseInput,
        outcome: { correct: true },
        exerciseType: 'multipleChoice',
        sourceContext: 'lesson',
      }),
    ).resolves.toBeUndefined();
    expect(stateModel.updateOne).not.toHaveBeenCalled();
  });
});
