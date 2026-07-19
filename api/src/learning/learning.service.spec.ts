import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { AnalyticsService } from '../analytics/analytics.service';
import { ContentService } from '../content/content.service';
import { LessonDetail } from '../content/dto/lesson-response.dto';
import { UserDocument } from '../user/schemas/user.schema';
import { UserService } from '../user/user.service';
import { LearningService, XP_PER_LESSON_COMPLETION } from './learning.service';
import { LessonCompletionDocument } from './schemas/lesson-completion.schema';
import { SrsCardDocument } from './schemas/srs-card.schema';

/** The practice award the fake ConfigService hands back. */
const XP_PER_LESSON_PRACTICE = 2;

const USER_ID = '607f1f77bcf86cd799439011';
const LESSON_ID = '507f1f77bcf86cd799439011';

const ITEM_IDS = [
  '607f1f77bcf86cd7994390a1',
  '607f1f77bcf86cd7994390a2',
  '607f1f77bcf86cd7994390a3',
];

function lessonDetail(): LessonDetail {
  return {
    id: LESSON_ID,
    lang: 'ja',
    unit: 'hiragana-basics',
    order: 0,
    title: 'Hiragana: the five vowels (あ row)',
    exerciseTypes: ['multipleChoice'],
    itemCount: ITEM_IDS.length,
    prerequisiteLessonIds: [],
    items: ITEM_IDS.map((id, i) => ({
      kind: 'kana' as const,
      id,
      kana: ['あ', 'い', 'う'][i],
      romaji: ['a', 'i', 'u'][i],
      script: 'hiragana',
      row: 'a',
      order: i,
    })),
  };
}

/** Existing cards the fake model should report for this user. */
function existingCard(itemId: string): SrsCardDocument {
  return {
    itemRef: { kind: 'kana', id: new Types.ObjectId(itemId) },
  } as unknown as SrsCardDocument;
}

interface Harness {
  service: LearningService;
  insertMany: jest.Mock;
  awardXp: jest.Mock;
  record: jest.Mock;
  completionUpdate: jest.Mock;
}

function build(
  opts: {
    existing?: SrsCardDocument[];
    xpAfter?: number;
    /** How many times this lesson has been completed *including* this call. */
    timesCompleted?: number;
  } = {},
): Harness {
  const insertMany = jest.fn((docs: unknown[]) => Promise.resolve(docs));
  const srsCardModel = {
    find: () => ({
      select: () => ({ exec: () => Promise.resolve(opts.existing ?? []) }),
    }),
    insertMany,
    countDocuments: () => ({ exec: () => Promise.resolve(0) }),
  };

  // Mirrors `findOneAndUpdate(..., { new: true })`: the value returned is the
  // document *after* the $inc, which is what decides the XP award.
  const completionUpdate = jest.fn(() => ({
    exec: () =>
      Promise.resolve({
        timesCompleted: opts.timesCompleted ?? 1,
      } as unknown as LessonCompletionDocument),
  }));
  const lessonCompletionModel = {
    findOneAndUpdate: completionUpdate,
    countDocuments: () => ({ exec: () => Promise.resolve(0) }),
  };

  const awardXp = jest.fn(() =>
    Promise.resolve({
      gamification: { xp: opts.xpAfter ?? XP_PER_LESSON_COMPLETION },
    } as unknown as UserDocument),
  );
  const record = jest.fn(() => Promise.resolve());

  const service = new LearningService(
    srsCardModel as never,
    lessonCompletionModel as never,
    { findLessonById: () => Promise.resolve(lessonDetail()) } as unknown as ContentService,
    { awardXp } as unknown as UserService,
    { record } as unknown as AnalyticsService,
    { get: () => XP_PER_LESSON_PRACTICE } as unknown as ConfigService,
  );

  return { service, insertMany, awardXp, record, completionUpdate };
}

describe('LearningService.completeLesson', () => {
  it('creates one card per lesson item, all starting in state "new"', async () => {
    const { service, insertMany } = build();

    const result = await service.completeLesson(USER_ID, LESSON_ID);

    expect(result.cardsCreated).toBe(3);
    expect(result.cardsAlreadyPresent).toBe(0);

    const inserted = insertMany.mock.calls[0][0] as {
      state: string;
      reps: number;
      lapses: number;
      lastReview: Date | null;
      due: Date;
      itemRef: { kind: string };
    }[];

    expect(inserted).toHaveLength(3);
    for (const card of inserted) {
      expect(card.state).toBe('new');
      expect(card.reps).toBe(0);
      expect(card.lapses).toBe(0);
      expect(card.lastReview).toBeNull();
      expect(card.due).toBeInstanceOf(Date);
      expect(card.itemRef.kind).toBe('kana');
    }
  });

  it('awards XP through UserService rather than touching the users collection', async () => {
    const { service, awardXp } = build({ xpAfter: 40 });

    const result = await service.completeLesson(USER_ID, LESSON_ID);

    expect(awardXp).toHaveBeenCalledWith(USER_ID, XP_PER_LESSON_COMPLETION);
    expect(result.xpAwarded).toBe(XP_PER_LESSON_COMPLETION);
    expect(result.totalXp).toBe(40);
  });

  it('emits a lesson.completed event with the completion details', async () => {
    const { service, record } = build();

    await service.completeLesson(USER_ID, LESSON_ID);

    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        type: 'lesson.completed',
        payload: expect.objectContaining({ lessonId: LESSON_ID, cardsCreated: 3 }),
      }),
    );
  });

  it('creates no cards on a repeat completion', async () => {
    const { service, insertMany } = build({
      existing: ITEM_IDS.map(existingCard),
    });

    const result = await service.completeLesson(USER_ID, LESSON_ID);

    expect(result.cardsCreated).toBe(0);
    expect(result.cardsAlreadyPresent).toBe(3);
    // Not just "inserted nothing" — it must not issue the write at all.
    expect(insertMany).not.toHaveBeenCalled();
  });

  it('creates only the missing cards when the user has a partial set', async () => {
    const { service, insertMany } = build({ existing: [existingCard(ITEM_IDS[0])] });

    const result = await service.completeLesson(USER_ID, LESSON_ID);

    expect(result.cardsCreated).toBe(2);
    expect(result.cardsAlreadyPresent).toBe(1);

    const inserted = insertMany.mock.calls[0][0] as { itemRef: { id: Types.ObjectId } }[];
    const insertedIds = inserted.map((c) => c.itemRef.id.toString());
    expect(insertedIds).not.toContain(ITEM_IDS[0]);
    expect(insertedIds).toEqual([ITEM_IDS[1], ITEM_IDS[2]]);
  });

  it('records the completion as an upsert, so a replay bumps the counter', async () => {
    const { service, completionUpdate } = build();

    await service.completeLesson(USER_ID, LESSON_ID);

    const [filter, update, opts] = completionUpdate.mock.calls[0] as [
      Record<string, unknown>,
      Record<string, Record<string, unknown>>,
      Record<string, unknown>,
    ];

    expect(filter).toEqual({
      userId: new Types.ObjectId(USER_ID),
      lessonId: new Types.ObjectId(LESSON_ID),
    });
    expect(opts.upsert).toBe(true);
    expect(update.$inc).toEqual({ timesCompleted: 1 });
    // firstCompletedAt only on insert — a replay must not rewrite it.
    expect(update.$setOnInsert).toHaveProperty('firstCompletedAt');
    expect(update.$set).toHaveProperty('lastCompletedAt');
  });

  it('awards the full amount on a first completion', async () => {
    const { service, awardXp } = build({ timesCompleted: 1 });

    const result = await service.completeLesson(USER_ID, LESSON_ID);

    expect(awardXp).toHaveBeenCalledWith(USER_ID, XP_PER_LESSON_COMPLETION);
    expect(result.xpAwarded).toBe(XP_PER_LESSON_COMPLETION);
    expect(result.firstCompletion).toBe(true);
  });

  it('awards only the practice amount on a repeat completion', async () => {
    // Was "still awards XP on a repeat completion", pinning the farming hole.
    // OPEN-ITEMS #0: replaying the POST must not keep paying full price.
    const { service, awardXp } = build({
      timesCompleted: 2,
      existing: ITEM_IDS.map(existingCard),
    });

    const result = await service.completeLesson(USER_ID, LESSON_ID);

    expect(awardXp).toHaveBeenCalledWith(USER_ID, XP_PER_LESSON_PRACTICE);
    expect(result.xpAwarded).toBe(XP_PER_LESSON_PRACTICE);
    expect(result.firstCompletion).toBe(false);
  });

  it('decides the award from the completion counter, not from cards created', async () => {
    // A genuine first completion of a lesson whose items are all already known
    // from an overlapping lesson: no cards created, but still first-time XP.
    const { service, awardXp } = build({
      timesCompleted: 1,
      existing: ITEM_IDS.map(existingCard),
    });

    const result = await service.completeLesson(USER_ID, LESSON_ID);

    expect(result.cardsCreated).toBe(0);
    expect(awardXp).toHaveBeenCalledWith(USER_ID, XP_PER_LESSON_COMPLETION);
    expect(result.firstCompletion).toBe(true);
  });

  it('cannot be farmed by replaying the POST', async () => {
    // Ten replays after the first: the counter climbs, the award does not.
    for (const timesCompleted of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
      const { service, awardXp } = build({ timesCompleted });

      const result = await service.completeLesson(USER_ID, LESSON_ID);

      expect(result.xpAwarded).toBe(XP_PER_LESSON_PRACTICE);
      expect(awardXp).toHaveBeenCalledWith(USER_ID, XP_PER_LESSON_PRACTICE);
    }
  });

  it('counts only what landed when a concurrent completion wins the race', async () => {
    const { service, insertMany } = build();
    // A racing request already inserted 1 of the 3; the unique index rejects it.
    insertMany.mockRejectedValueOnce(
      Object.assign(new Error('E11000 duplicate key'), {
        code: 11000,
        writeErrors: [{ err: { code: 11000 } }],
      }),
    );

    const result = await service.completeLesson(USER_ID, LESSON_ID);

    // The duplicate is not counted as created, and nothing throws.
    expect(result.cardsCreated).toBe(2);
  });

  it('surfaces a non-duplicate insert failure rather than reporting success', async () => {
    const { service, insertMany } = build();
    insertMany.mockRejectedValueOnce(new Error('mongo is on fire'));

    await expect(service.completeLesson(USER_ID, LESSON_ID)).rejects.toThrow('mongo is on fire');
  });

  it('completes successfully even when the analytics write throws', async () => {
    const { service, record, awardXp } = build();
    record.mockRejectedValueOnce(new Error('mongo down'));

    // Cards and XP are already committed at that point — losing the event row
    // must not turn a successful completion into a 500.
    const result = await service.completeLesson(USER_ID, LESSON_ID);

    expect(result.cardsCreated).toBe(3);
    expect(awardXp).toHaveBeenCalled();
  });
});
