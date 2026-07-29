import { Types } from 'mongoose';
import { ContentKind } from '../knowledge-graph/schemas/knowledge-node.schema';
import { LearnerItemStateService } from './learner-item-state.service';
import { SourceContext } from './schemas/learner-item-state.schema';

const USER = new Types.ObjectId('607f1f77bcf86cd799439011');
const ITEM_A = new Types.ObjectId('507f1f77bcf86cd7994390a1');
const ITEM_B = new Types.ObjectId('507f1f77bcf86cd7994390a2');

interface CardStub {
  userId: Types.ObjectId;
  itemRef: { kind: string; id: Types.ObjectId };
  totalReviews: number;
  correctReviews: number;
  lastReview: Date | null;
  createdAt?: Date;
}

/**
 * The backfill is the whole of this slice, so what matters is that it preserves
 * evidence honestly, never doubles, and never overwrites a state that has since
 * accumulated more than the card knows.
 */
describe('LearnerItemStateService.backfillFromSrsCards (ADR-003)', () => {
  function makeService(cards: CardStub[], existing: Record<string, unknown>[] = []) {
    const created: Record<string, unknown>[] = [];

    const cardModel = {
      find: () => ({
        cursor: () => (async function* () {
          for (const card of cards) yield card;
        })(),
      }),
    };

    const stateModel = {
      findOne: jest.fn((filter: Record<string, unknown>) => ({
        exec: () =>
          Promise.resolve(
            existing.find(
              (state) =>
                (state['itemRef.id'] as Types.ObjectId | undefined)?.toString() ===
                (filter['itemRef.id'] as Types.ObjectId).toString(),
            ) ?? null,
          ),
      })),
      create: jest.fn((doc: Record<string, unknown>) => {
        created.push(doc);
        return Promise.resolve(doc);
      }),
      countDocuments: () => ({ exec: () => Promise.resolve(created.length) }),
    };

    const service = new LearnerItemStateService(stateModel as never, cardModel as never);
    return { service, created, stateModel };
  }

  function card(overrides: Partial<CardStub> = {}): CardStub {
    return {
      userId: USER,
      itemRef: { kind: 'kana', id: ITEM_A },
      totalReviews: 0,
      correctReviews: 0,
      lastReview: null,
      ...overrides,
    };
  }

  it('creates one state per card, keyed on the same (user, item) the card uses', async () => {
    const { service, created } = makeService([
      card({ itemRef: { kind: 'kana', id: ITEM_A } }),
      card({ itemRef: { kind: 'vocab', id: ITEM_B } }),
    ]);

    const report = await service.backfillFromSrsCards();

    expect(report).toEqual({ cards: 2, created: 2, skipped: 0 });
    expect(created).toHaveLength(2);
    expect(created[0].userId).toBe(USER);
    expect(created[0].itemRef).toEqual({ kind: 'kana', id: ITEM_A });
  });

  /**
   * ADR-003's reason for doing this now rather than in six months: the counts on
   * the card are real, so the backfill preserves them instead of writing zeros.
   */
  it('carries the card’s review counts across as evidence', async () => {
    const { service, created } = makeService([
      card({ totalReviews: 8, correctReviews: 6, lastReview: new Date('2026-07-20T10:00:00Z') }),
    ]);

    await service.backfillFromSrsCards();

    expect(created[0].exposures).toBe(8);
    expect(created[0].correct).toBe(6);
    expect(created[0].incorrect).toBe(2);
    expect(created[0].lastSeenAt).toEqual(new Date('2026-07-20T10:00:00Z'));
    expect(created[0].sourceContexts).toEqual(['review']);
  });

  /**
   * A card cannot report more correct reviews than reviews, but if one ever did,
   * `incorrect` must not go negative — the schema's `min: 0` would reject the row
   * and take the whole migration down with it.
   */
  it('clamps rather than producing negative evidence from an inconsistent card', async () => {
    const { service, created } = makeService([card({ totalReviews: 3, correctReviews: 5 })]);

    await service.backfillFromSrsCards();

    expect(created[0].correct).toBe(3);
    expect(created[0].incorrect).toBe(0);
  });

  it('leaves a never-reviewed card as a new item with no provenance', async () => {
    const { service, created } = makeService([card({ totalReviews: 0, correctReviews: 0 })]);

    await service.backfillFromSrsCards();

    expect(created[0].exposures).toBe(0);
    expect(created[0].confidence).toBe(0);
    expect(created[0].masteryLevel).toBe('new');
    expect(created[0].sourceContexts).toEqual([]);
    expect(created[0].lastNOutcomes).toEqual([]);
  });

  /**
   * Response times exist on `ExerciseAttempt` but cannot be attributed to an item
   * — the row records no item id — so every backfilled state starts with empty
   * statistics rather than a guess.
   */
  it('starts response-time statistics empty, because none can be attributed', async () => {
    const { service, created } = makeService([card({ totalReviews: 5, correctReviews: 5 })]);

    await service.backfillFromSrsCards();

    expect(created[0].responseTimeMs).toEqual({ count: 0, mean: 0, m2: 0 });
    expect(created[0].byExerciseType).toEqual(new Map());
  });

  it('recomputes confidence and mastery from the evidence it wrote', async () => {
    const { service, created } = makeService([card({ totalReviews: 10, correctReviews: 10 })]);

    await service.backfillFromSrsCards();

    // Ten correct reviews is full evidence with a perfect recency ring; the speed
    // term is neutral because no baseline exists yet.
    expect(created[0].confidence).toBeGreaterThan(0.8);
    expect(created[0].masteryLevel).toBe('mastered');
  });

  it('reconstructs a proportional recency ring, most recent outcomes correct', async () => {
    const { service, created } = makeService([card({ totalReviews: 20, correctReviews: 18 })]);

    await service.backfillFromSrsCards();

    const outcomes = created[0].lastNOutcomes as boolean[];
    expect(outcomes).toHaveLength(10);
    // 18/20 correct scales to 1 wrong in 10, and the wrong one goes first so a
    // learner who has since improved is not punished by an order nobody recorded.
    expect(outcomes.filter((correct) => !correct)).toHaveLength(1);
    expect(outcomes[0]).toBe(false);
    expect(outcomes[outcomes.length - 1]).toBe(true);
  });

  /**
   * The property that makes the migration re-runnable, which is what makes anyone
   * willing to run it twice.
   */
  it('skips a card that already has a state rather than overwriting it', async () => {
    const { service, created, stateModel } = makeService(
      [card({ totalReviews: 4, correctReviews: 4 })],
      [{ 'itemRef.id': ITEM_A, exposures: 99 }],
    );

    const report = await service.backfillFromSrsCards();

    expect(report).toEqual({ cards: 1, created: 0, skipped: 1 });
    expect(created).toHaveLength(0);
    expect(stateModel.create).not.toHaveBeenCalled();
  });
});

/**
 * §5.2 / ADR-003: the write path. Three things the spec must prove:
 *   1. Fresh state is created with derived fields consistent with evidence.
 *   2. Updates preserve firstSeenAt and roll the recency ring forward.
 *   3. The byExerciseType map only grows on lesson contexts (decision 2).
 *
 * The stub here is separate from the backfill stub: `record()` does not touch
 * `srsCards` and uses `findOne` + `updateOne` rather than the cursor +
 * `create` shape the backfill needs.
 */
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

    const cardModel = {} as never;
    const service = new LearnerItemStateService(stateModel as never, cardModel);
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

  it('never touches byExerciseType when exerciseType is null (review / chat)', async () => {
    // Decision (2): review and chat contexts add to totals / ring / response
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
    const service = new LearnerItemStateService(stateModel as never, {} as never);

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
    const service = new LearnerItemStateService(stateModel as never, {} as never);

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
