import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { AnalyticsService } from '../analytics/analytics.service';
import { ContentService } from '../content/content.service';
import { ResolvedItem } from '../content/dto/lesson-response.dto';
import { UserDocument } from '../user/schemas/user.schema';
import { UserService } from '../user/user.service';
import { newCardFields, ReviewGrade } from './fsrs-card.mapper';
import { LearnerItemStateService } from './learner-item-state.service';
import { ReviewService, REVIEW_SESSION_CAP, XP_PER_REVIEW } from './review.service';
import { SrsCardDocument } from './schemas/srs-card.schema';

const USER_ID = '607f1f77bcf86cd799439011';
const CARD_ID = '507f1f77bcf86cd799439011';
const ITEM_ID = '507f1f77bcf86cd7994390ff';

/**
 * A stand-in SrsCard document: holds §5's fields, and `set`/`save` behave like
 * Mongoose's so the service's persistence path is genuinely exercised.
 */
function makeCard(overrides: Partial<Record<string, unknown>> = {}): SrsCardDocument {
  const card = {
    _id: new Types.ObjectId(CARD_ID),
    userId: new Types.ObjectId(USER_ID),
    itemRef: { kind: 'kana', id: new Types.ObjectId(ITEM_ID) },
    ...newCardFields(new Date('2026-07-18T00:00:00Z')),
    ...overrides,
    set(fields: Record<string, unknown>) {
      Object.assign(this, fields);
    },
    save() {
      return Promise.resolve(this);
    },
  };

  return card as unknown as SrsCardDocument;
}

const KANA_ITEM: ResolvedItem = {
  kind: 'kana',
  id: ITEM_ID,
  kana: 'あ',
  romaji: 'a',
  script: 'hiragana',
  row: 'a',
  order: 0,
};

function build(opts: { card?: SrsCardDocument; dueCards?: SrsCardDocument[]; totalDue?: number } = {}) {
  const card = opts.card ?? makeCard();
  const dueCards = opts.dueCards ?? [card];

  const srsCardModel = {
    findOne: () => ({ exec: () => Promise.resolve(opts.card === null ? null : card) }),
    find: () => ({
      sort: () => ({ limit: () => ({ exec: () => Promise.resolve(dueCards) }) }),
    }),
    countDocuments: () => ({ exec: () => Promise.resolve(opts.totalDue ?? dueCards.length) }),
  };

  const awardXp = jest.fn(() =>
    Promise.resolve({ gamification: { xp: 100 } } as unknown as UserDocument),
  );
  // The not-due path reads the user instead of awarding, so it still needs a
  // total to report.
  const findById = jest.fn(() =>
    Promise.resolve({ gamification: { xp: 100 } } as unknown as UserDocument),
  );
  const record = jest.fn(() => Promise.resolve());
  const recordLearnerItem = jest.fn(() => Promise.resolve());

  const service = new ReviewService(
    srsCardModel as never,
    {
      resolveItemRefs: (refs: unknown[]) =>
        Promise.resolve(refs.map(() => KANA_ITEM)),
    } as unknown as ContentService,
    { awardXp, findById } as unknown as UserService,
    { record } as unknown as AnalyticsService,
    { record: recordLearnerItem } as unknown as LearnerItemStateService,
  );

  return { service, card, awardXp, findById, record, recordLearnerItem };
}

/** A card scheduled into the future — i.e. one the learner has already done. */
function notDueCard(): SrsCardDocument {
  const future = new Date(Date.now() + 60 * 60 * 1000);
  return makeCard({ due: future, state: 'review', reps: 3 });
}

/** Grade a fresh card once and report how far out it lands, in minutes. */
async function intervalAfter(grades: ReviewGrade[]): Promise<number[]> {
  const { service, card } = build();
  const intervals: number[] = [];

  for (const grade of grades) {
    const before = Date.now();
    const result = await service.grade(USER_ID, CARD_ID, grade);
    intervals.push(Math.round((result.due.getTime() - before) / 60_000));
    // The mock card mutates in place, so the next grade sees the updated state —
    // which is what makes a sequence of grades meaningful.
    void card;
  }

  return intervals;
}

describe('ReviewService.grade — scheduling behaviour', () => {
  it('schedules a card graded "again" sooner than one graded "good"', async () => {
    const [again] = await intervalAfter(['again']);
    const [good] = await intervalAfter(['good']);

    expect(again).toBeLessThan(good);
  });

  it('orders all four grades: again <= hard <= good <= easy', async () => {
    const [again] = await intervalAfter(['again']);
    const [hard] = await intervalAfter(['hard']);
    const [good] = await intervalAfter(['good']);
    const [easy] = await intervalAfter(['easy']);

    expect(again).toBeLessThanOrEqual(hard);
    expect(hard).toBeLessThanOrEqual(good);
    expect(good).toBeLessThanOrEqual(easy);
    // And the extremes are meaningfully apart, not all clustered on one step.
    expect(easy).toBeGreaterThan(again);
  });

  it('pushes due progressively further out across repeated "good" grades', async () => {
    // Reviews happen *when the card comes due*, which is what spaced repetition
    // means. Grading five times in one instant is cramming, and FSRS correctly
    // declines to keep extending for that — see the cramming test below.
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2026-07-18T00:00:00Z'));
      const { service } = build();
      const intervals: number[] = [];

      for (let i = 0; i < 5; i++) {
        const now = Date.now();
        const result = await service.grade(USER_ID, CARD_ID, 'good');
        intervals.push(Math.round((result.due.getTime() - now) / 60_000));
        jest.setSystemTime(result.due);
      }

      // Strictly increasing — the property that fails outright if learningSteps
      // isn't persisted, where every interval would stay pinned at 10 minutes.
      for (let i = 1; i < intervals.length; i++) {
        expect(intervals[i]).toBeGreaterThan(intervals[i - 1]);
      }

      // And it reaches real spacing: the last interval is months, not minutes.
      expect(intervals[0]).toBeLessThanOrEqual(60);
      expect(intervals[intervals.length - 1]).toBeGreaterThan(30 * 24 * 60);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not keep extending when the same card is crammed in one sitting', async () => {
    // Documents real FSRS behaviour: without elapsed time between reviews there
    // is no retention evidence to reward, so intervals plateau. A test that
    // graded in a tight loop and expected growth would be asserting a bug.
    const intervals = await intervalAfter(['good', 'good', 'good', 'good', 'good']);

    expect(intervals[intervals.length - 1]).toBeGreaterThanOrEqual(intervals[0]);
    expect(new Set(intervals).size).toBeLessThan(intervals.length);
  });

  it('graduates a card out of learning and into review', async () => {
    const { service } = build();

    const first = await service.grade(USER_ID, CARD_ID, 'good');
    expect(first.state).toBe('learning');

    const second = await service.grade(USER_ID, CARD_ID, 'good');
    expect(second.state).toBe('review');
  });

  it('counts a lapse when a graduated card is graded "again"', async () => {
    const { service } = build();

    await service.grade(USER_ID, CARD_ID, 'good');
    await service.grade(USER_ID, CARD_ID, 'good');
    const graduated = await service.grade(USER_ID, CARD_ID, 'good');
    expect(graduated.lapses).toBe(0);

    const lapsed = await service.grade(USER_ID, CARD_ID, 'again');
    expect(lapsed.lapses).toBe(1);
    expect(lapsed.state).toBe('relearning');
  });

  it('increments reps on every grade', async () => {
    const { service } = build();

    expect((await service.grade(USER_ID, CARD_ID, 'good')).reps).toBe(1);
    expect((await service.grade(USER_ID, CARD_ID, 'again')).reps).toBe(2);
    expect((await service.grade(USER_ID, CARD_ID, 'hard')).reps).toBe(3);
  });

  it('persists the full FSRS state, not just the due date', async () => {
    const { service, card } = build();

    await service.grade(USER_ID, CARD_ID, 'good');

    // Read back off the document the service saved.
    const saved = card as unknown as Record<string, unknown>;
    expect(saved.stability).toBeGreaterThan(0);
    expect(saved.difficulty).toBeGreaterThan(0);
    expect(saved.due).toBeInstanceOf(Date);
    expect(saved.lastReview).toBeInstanceOf(Date);
    expect(saved.state).toBe('learning');
    expect(saved.reps).toBe(1);
    // The field beyond §5 — without it the card never leaves learning.
    expect(typeof saved.learningSteps).toBe('number');
  });
});

describe('ReviewService.grade — XP is gated on the card being due', () => {
  it('awards XP when the card is due', async () => {
    const { service, awardXp } = build();

    const result = await service.grade(USER_ID, CARD_ID, 'good');

    expect(awardXp).toHaveBeenCalledWith(USER_ID, XP_PER_REVIEW);
    expect(result.xpAwarded).toBe(XP_PER_REVIEW);
  });

  it('awards nothing when the card is not yet due', async () => {
    // OPEN-ITEMS #0b: back-to-back grading was the review-loop twin of the
    // lesson XP farming hole.
    const { service, awardXp } = build({ card: notDueCard() });

    const result = await service.grade(USER_ID, CARD_ID, 'good');

    expect(result.xpAwarded).toBe(0);
    expect(awardXp).not.toHaveBeenCalled();
  });

  it('still reschedules a not-yet-due card, because that part was never wrong', async () => {
    const { service, card } = build({ card: notDueCard() });
    const before = (card as unknown as { due: Date }).due.getTime();

    const result = await service.grade(USER_ID, CARD_ID, 'good');

    // ts-fsrs owns this; grading out of turn is legitimate, it just isn't paid.
    expect(result.due.getTime()).not.toBe(before);
    expect(result.reps).toBeGreaterThan(0);
  });

  it('does not advance the streak when nothing was earned', async () => {
    // awardXp is also where the streak rolls, so calling it with 0 would let a
    // learner hold a streak by re-grading one card.
    const { service, awardXp, findById } = build({ card: notDueCard() });

    const result = await service.grade(USER_ID, CARD_ID, 'good');

    expect(awardXp).not.toHaveBeenCalled();
    expect(findById).toHaveBeenCalledWith(USER_ID);
    // The total is still reported, just unchanged.
    expect(result.totalXp).toBe(100);
  });

  it('pays for the first grade of a due card and nothing for an immediate re-grade', async () => {
    // The exact sequence a flaky client produces: the same card graded twice in
    // a row. The mock card mutates in place, so the second call sees the future
    // due date the first one wrote.
    const { service, awardXp } = build();

    const first = await service.grade(USER_ID, CARD_ID, 'good');
    const second = await service.grade(USER_ID, CARD_ID, 'good');

    expect(first.xpAwarded).toBe(XP_PER_REVIEW);
    expect(second.xpAwarded).toBe(0);
    expect(awardXp).toHaveBeenCalledTimes(1);
  });
});

describe('ReviewService.grade — plumbing', () => {
  it('reports the new total after awarding', async () => {
    const { service } = build();

    const result = await service.grade(USER_ID, CARD_ID, 'good');

    expect(result.totalXp).toBe(100);
  });

  it('emits a review.graded event carrying the grade and outcome', async () => {
    const { service, record } = build();

    await service.grade(USER_ID, CARD_ID, 'hard');

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        type: 'review.graded',
        payload: expect.objectContaining({ cardId: CARD_ID, grade: 'hard' }),
      }),
    );
  });

  it('still returns the grade when the analytics write throws', async () => {
    const { service, record } = build();
    record.mockRejectedValueOnce(new Error('mongo down'));

    // The card is already persisted; a lost event must not undo the review.
    await expect(service.grade(USER_ID, CARD_ID, 'good')).resolves.toMatchObject({
      grade: 'good',
    });
  });

  it('rejects a malformed card id', async () => {
    const { service } = build();

    await expect(service.grade(USER_ID, 'not-an-id', 'good')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("404s rather than revealing another user's card", async () => {
    const { service } = build({ card: null as unknown as SrsCardDocument });

    await expect(service.grade(USER_ID, CARD_ID, 'good')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('ReviewService.findDue', () => {
  it('returns due cards with their content resolved for display', async () => {
    const { service } = build();

    const response = await service.findDue(USER_ID);

    expect(response.count).toBe(1);
    expect(response.cap).toBe(REVIEW_SESSION_CAP);
    expect(response.cards[0].item).toMatchObject({ kana: 'あ', romaji: 'a' });
    expect(response.cards[0].cardId).toBe(CARD_ID);
  });

  it('reports the true total due alongside the capped batch', async () => {
    const { service } = build({ dueCards: [makeCard()], totalDue: 47 });

    const response = await service.findDue(USER_ID);

    // A client can render "1 of 47" without a second request.
    expect(response.count).toBe(1);
    expect(response.totalDue).toBe(47);
  });

  it('caps the session at 20', () => {
    // §6: sessions must be bounded. Pinned so the cap can't drift silently.
    expect(REVIEW_SESSION_CAP).toBe(20);
  });
});

describe('ReviewService — Mastery & Weakness Model', () => {
  it('includes mastery level, totalReviews, and accuracyRate in findDue', async () => {
    const card = makeCard({ state: 'review', stability: 12, reps: 5, totalReviews: 4, correctReviews: 3 });
    const { service } = build({ card });

    const response = await service.findDue(USER_ID);

    expect(response.cards[0].mastery).toBe('familiar');
    expect(response.cards[0].totalReviews).toBe(4);
    expect(response.cards[0].accuracyRate).toBe(0.75);
  });

  it('updates totalReviews and correctReviews on grade good/easy', async () => {
    const { service, card } = build();

    const result = await service.grade(USER_ID, CARD_ID, 'good', 2500);

    expect(result.mastery).toBe('learning');
    expect(result.totalReviews).toBe(1);
    expect(result.accuracyRate).toBe(1);
    expect((card as unknown as Record<string, unknown>).totalReviews).toBe(1);
    expect((card as unknown as Record<string, unknown>).correctReviews).toBe(1);
  });

  it('passes responseTimeMs to analytics event on grade', async () => {
    const { service, record } = build();

    await service.grade(USER_ID, CARD_ID, 'good', 1450);

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'review.graded',
        payload: expect.objectContaining({ responseTimeMs: 1450 }),
      }),
    );
  });
});

/**
 * §5.2 / ADR-003: the learner-model write path. Every grade emits one
 * `LearnerItemStateService.record()` call carrying the card's `itemRef` and
 * `sourceContext: 'review'`. `correct` mirrors the predicate
 * `card.correctReviews` uses so the two stay in lockstep.
 */
describe('ReviewService.grade — writes learner-model evidence (ADR-003)', () => {
  it('records an exposure with sourceContext review and correct=true on good', async () => {
    const { service, recordLearnerItem } = build();

    await service.grade(USER_ID, CARD_ID, 'good', 1500);

    expect(recordLearnerItem).toHaveBeenCalledTimes(1);
    expect(recordLearnerItem).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: expect.anything(),
        itemRef: { kind: 'kana', id: new Types.ObjectId(ITEM_ID) },
        outcome: { correct: true, responseTimeMs: 1500 },
        exerciseType: null,
        sourceContext: 'review',
      }),
    );
  });

  it('records correct=false on hard — not every "passed" grade is a correct one for the learner model', async () => {
    // 'good' and 'easy' count as correct; 'hard' and 'again' do not. The SRS
    // scheduler still reschedules on 'hard', but the learner model reads
    // "they didn't get this one cleanly", so `correct: false`.
    const { service, recordLearnerItem } = build();

    await service.grade(USER_ID, CARD_ID, 'hard');

    expect(recordLearnerItem).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: { correct: false, responseTimeMs: undefined } }),
    );
  });

  it('records on every grade, not only when wasDue is true', async () => {
    // Evidence is independent of the XP gate — a not-due re-grade is still a
    // graded exposure that says something about how the learner handles the
    // word. Suppressing it on the not-due path would lose that signal.
    const { service, recordLearnerItem } = build({ card: notDueCard() });

    await service.grade(USER_ID, CARD_ID, 'good');

    expect(recordLearnerItem).toHaveBeenCalledTimes(1);
  });

  it('does not fail the grade when the learner-model write throws', async () => {
    // Same fire-and-forget contract as the analytics event: the card is
    // already saved; losing the pedagogical-model row must not undo the grade.
    const { service, recordLearnerItem } = build();
    recordLearnerItem.mockRejectedValueOnce(new Error('mongo down'));

    await expect(service.grade(USER_ID, CARD_ID, 'good')).resolves.toMatchObject({
      grade: 'good',
    });
  });
});

