import { Types } from 'mongoose';
import { LearnerItemStateService } from './learner-item-state.service';

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
