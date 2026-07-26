import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { AnalyticsService } from '../analytics/analytics.service';
import { ContentService } from '../content/content.service';
import { LessonDetail } from '../content/dto/lesson-response.dto';
import {
  GEMS_PER_LESSON_COMPLETION,
  GEMS_PER_LESSON_PRACTICE,
} from '../user/gamification/hearts';
import { UserDocument } from '../user/schemas/user.schema';
import { UserService } from '../user/user.service';
import { ExerciseAttemptsService } from './exercise-attempts.service';
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

function lessonDetail(prerequisiteLessonIds: string[] = []): LessonDetail {
  return {
    id: LESSON_ID,
    lang: 'ja',
    unit: 'hiragana-basics',
    order: 0,
    title: 'Hiragana: the five vowels (あ row)',
    exerciseTypes: ['multipleChoice'],
    itemCount: ITEM_IDS.length,
    prerequisiteLessonIds,
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
  awardGems: jest.Mock;
  record: jest.Mock;
  completionUpdate: jest.Mock;
  countAttempts: jest.Mock;
  hasCleanAttempt: jest.Mock;
}

function build(
  opts: {
    existing?: SrsCardDocument[];
    xpAfter?: number;
    /** How many times this lesson has been completed *including* this call. */
    timesCompleted?: number;
    /** Lesson ids the completions collection should report for this user. */
    completedLessonIds?: string[];
    /** Prerequisite ids the lesson should declare. */
    prerequisiteLessonIds?: string[];
    /** How many exercise attempts the user has logged for this lesson. */
    attemptCount?: number;
    /**
     * Whether some attempt of this lesson was finished with nothing wrong — the
     * completion gate's real condition since the all-correct rule landed.
     * Defaults true so the many tests that only care about cards and XP keep
     * passing without per-test plumbing.
     */
    cleanAttempt?: boolean;
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
    // Mirrors find().select('lessonId').lean().exec(). lean() yields plain
    // objects, so lessonId arrives as a raw ObjectId rather than a hydrated doc.
    find: () => ({
      select: () => ({
        lean: () => ({
          exec: () =>
            Promise.resolve(
              (opts.completedLessonIds ?? []).map((id) => ({ lessonId: new Types.ObjectId(id) })),
            ),
        }),
      }),
    }),
  };

  const awardXp = jest.fn(() =>
    Promise.resolve({
      gamification: { xp: opts.xpAfter ?? XP_PER_LESSON_COMPLETION },
    } as unknown as UserDocument),
  );
  const record = jest.fn(() => Promise.resolve());
  // Gems ride alongside XP on completion (slice 2). Stubbed here; the arithmetic
  // and the gem/heart economy live in `hearts.spec.ts`.
  const awardGems = jest.fn(() => Promise.resolve());

  // Gate #2 (at-least-one-answered) is wired here. By default every call
  // returns 1 so the existing tests — which all rely on the gate passing —
  // keep working without per-test plumbing. Tests for the failure mode set
  // `attemptCount: 0` explicitly.
  const countAttempts = jest.fn(() => Promise.resolve(opts.attemptCount ?? 1));
  const hasCleanAttempt = jest.fn(() => Promise.resolve(opts.cleanAttempt ?? true));
  const exerciseAttempts = {
    countAttemptsForLesson: countAttempts,
    hasCleanAttemptForLesson: hasCleanAttempt,
  } as unknown as ExerciseAttemptsService;

  const service = new LearningService(
    srsCardModel as never,
    lessonCompletionModel as never,
    {
      findLessonById: () => Promise.resolve(lessonDetail(opts.prerequisiteLessonIds)),
    } as unknown as ContentService,
    { awardXp, awardGems } as unknown as UserService,
    { record } as unknown as AnalyticsService,
    exerciseAttempts,
    { get: () => XP_PER_LESSON_PRACTICE } as unknown as ConfigService,
  );

  return {
    service,
    insertMany,
    awardXp,
    awardGems,
    record,
    completionUpdate,
    countAttempts,
    hasCleanAttempt,
  };
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

describe('LearningService.findCompletedLessonIds', () => {
  it('returns lesson ids as strings, because the client compares them to JSON', async () => {
    const ids = ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'];
    const { service } = build({ completedLessonIds: ids });

    const result = await service.findCompletedLessonIds(USER_ID);

    // The ObjectIds must be stringified here. Leaving them hydrated serialises
    // to an object, and `prerequisiteLessonIds.every(id => completed.has(id))`
    // on the client would then never match and lock every lesson forever.
    expect(result).toEqual(ids);
    for (const id of result) {
      expect(typeof id).toBe('string');
    }
  });

  it('returns an empty array for a user who has completed nothing', async () => {
    const { service } = build();

    await expect(service.findCompletedLessonIds(USER_ID)).resolves.toEqual([]);
  });
});

describe('LearningService.completeLesson gate (T1.4)', () => {
  it('returns 409 when any prerequisite is missing, naming the missing ids', async () => {
    const { service, awardXp, insertMany, countAttempts } = build({
      prerequisiteLessonIds: ['507f1f77bcf86cd7994390aa', '507f1f77bcf86cd7994390bb'],
      // Both are absent from completedLessonIds.
      completedLessonIds: [],
    });

    await expect(service.completeLesson(USER_ID, LESSON_ID)).rejects.toThrow(
      /Complete these lessons first: .*507f1f77bcf86cd7994390aa.*507f1f77bcf86cd7994390bb/,
    );

    // No XP, no cards, no attempt read for the second gate.
    expect(awardXp).not.toHaveBeenCalled();
    expect(insertMany).not.toHaveBeenCalled();
    expect(countAttempts).not.toHaveBeenCalled();
  });

  it('passes the prerequisite gate when every prerequisite is completed', async () => {
    const prereqA = '507f1f77bcf86cd7994390aa';
    const prereqB = '507f1f77bcf86cd7994390bb';
    const { service, awardXp } = build({
      prerequisiteLessonIds: [prereqA, prereqB],
      completedLessonIds: [prereqA, prereqB],
    });

    const result = await service.completeLesson(USER_ID, LESSON_ID);

    expect(result.xpAwarded).toBe(XP_PER_LESSON_COMPLETION);
    expect(awardXp).toHaveBeenCalledWith(USER_ID, XP_PER_LESSON_COMPLETION);
  });

  it('returns 409 when the user has answered zero exercises for this lesson', async () => {
    const { service, awardXp, insertMany, completionUpdate } = build({
      attemptCount: 0,
      cleanAttempt: false,
    });

    await expect(service.completeLesson(USER_ID, LESSON_ID)).rejects.toThrow(
      'Answer the exercises before completing this lesson.',
    );

    // Nothing past the gate ran.
    expect(awardXp).not.toHaveBeenCalled();
    expect(insertMany).not.toHaveBeenCalled();
    expect(completionUpdate).not.toHaveBeenCalled();
  });

  /**
   * The bug this rule exists for, reported from the live site: answering
   * everything wrong and still finishing the lesson. Getting a question wrong
   * means you did not know it, so completing on that basis makes the XP and the
   * "done" tick both lie.
   */
  it('returns 409 when questions were answered but some are still wrong', async () => {
    const { service, awardXp, insertMany, completionUpdate } = build({
      attemptCount: 5,
      cleanAttempt: false,
    });

    await expect(service.completeLesson(USER_ID, LESSON_ID)).rejects.toThrow(
      'Answer every exercise correctly before completing this lesson.',
    );

    expect(awardXp).not.toHaveBeenCalled();
    expect(insertMany).not.toHaveBeenCalled();
    expect(completionUpdate).not.toHaveBeenCalled();
  });

  /**
   * The two failures say different things on purpose — "you have not started" and
   * "you have work left" are not the same message, and conflating them would tell
   * a learner mid-lesson that they had answered nothing.
   */
  it('distinguishes "answered nothing" from "answered wrongly" in the message', async () => {
    const nothing = build({ attemptCount: 0, cleanAttempt: false });
    const wrong = build({ attemptCount: 4, cleanAttempt: false });

    await expect(nothing.service.completeLesson(USER_ID, LESSON_ID)).rejects.toThrow(
      /Answer the exercises/,
    );
    await expect(wrong.service.completeLesson(USER_ID, LESSON_ID)).rejects.toThrow(
      /every exercise correctly/,
    );
  });

  it('passes once some attempt was finished with everything correct', async () => {
    const { service, awardXp, hasCleanAttempt } = build({ cleanAttempt: true });

    const result = await service.completeLesson(USER_ID, LESSON_ID);

    expect(hasCleanAttempt).toHaveBeenCalledWith(USER_ID, LESSON_ID);
    expect(result.xpAwarded).toBe(XP_PER_LESSON_COMPLETION);
    expect(awardXp).toHaveBeenCalled();
  });

  /**
   * Only asked for the error copy, so the happy path stays one read rather than
   * two — the gate is on every completion.
   */
  it('does not count attempts at all when the clean check already passed', async () => {
    const { service, countAttempts } = build({ cleanAttempt: true });

    await service.completeLesson(USER_ID, LESSON_ID);

    expect(countAttempts).not.toHaveBeenCalled();
  });

  it('checks prerequisites before engagement, so a missing prereq does not even probe attempts', async () => {
    const { service, countAttempts } = build({
      prerequisiteLessonIds: ['507f1f77bcf86cd7994390aa'],
      completedLessonIds: [],
      attemptCount: 0,
    });

    await expect(service.completeLesson(USER_ID, LESSON_ID)).rejects.toThrow();

    // Order matters: prereq first, so we don't spend a query on a request
    // that's already going to fail.
    expect(countAttempts).not.toHaveBeenCalled();
  });
});

/**
 * §7 step 7 (T1.5): a chat correction schedules the words it touched.
 *
 * Its own harness rather than the shared one, because it needs `updateMany` on
 * the card model and `findVocabInTexts` on content — neither of which the
 * completion tests use.
 */
function buildScheduler(
  opts: {
    /** Words `findVocabInTexts` should claim to have matched. */
    matched?: { id: string; lemma: string }[];
    /** Cards the user already holds, as (itemId, due) pairs. */
    existing?: { id: string; due: Date }[];
  } = {},
) {
  const matched = (opts.matched ?? []).map(
    (word) => ({ _id: new Types.ObjectId(word.id), lemma: word.lemma }) as never,
  );
  const existing = (opts.existing ?? []).map(
    (card) =>
      ({
        _id: new Types.ObjectId(card.id),
        itemRef: { kind: 'vocab', id: new Types.ObjectId(card.id) },
        due: card.due,
      }) as unknown as SrsCardDocument,
  );

  const insertMany = jest.fn((docs: unknown[]) => Promise.resolve(docs));
  // Params are declared so `updateMany.mock.calls[0][1]` is typed — the test
  // that pins "only `due` is written" reads the update document off the call.
  const updateMany = jest.fn(
    (_filter: unknown, _update: { $set: Record<string, unknown> }) => ({
      exec: () => Promise.resolve({ modifiedCount: 99 }),
    }),
  );
  const srsCardModel = {
    find: () => ({ select: () => ({ exec: () => Promise.resolve(existing) }) }),
    insertMany,
    updateMany,
    countDocuments: () => ({ exec: () => Promise.resolve(0) }),
  };

  const findVocabInTexts = jest.fn(() => Promise.resolve(matched));

  const service = new LearningService(
    srsCardModel as never,
    { countDocuments: () => ({ exec: () => Promise.resolve(0) }) } as never,
    { findVocabInTexts } as unknown as ContentService,
    {} as unknown as UserService,
    { record: jest.fn() } as unknown as AnalyticsService,
    {} as unknown as ExerciseAttemptsService,
    { get: () => XP_PER_LESSON_PRACTICE } as unknown as ConfigService,
  );

  return { service, insertMany, updateMany, findVocabInTexts };
}

const WORD_A = '707f1f77bcf86cd799439001';
const WORD_B = '707f1f77bcf86cd799439002';

describe('LearningService.scheduleMissedWords (T1.5)', () => {
  it('creates a card, due now, for a corrected word the learner has none for', async () => {
    const { service, insertMany } = buildScheduler({
      matched: [{ id: WORD_A, lemma: 'がっこう' }],
    });

    const result = await service.scheduleMissedWords(USER_ID, ['がっこ', 'がっこう']);

    expect(result.cardsCreated).toBe(1);
    const inserted = insertMany.mock.calls[0][0] as {
      itemRef: { kind: string; id: Types.ObjectId };
      due: Date;
    }[];
    expect(inserted).toHaveLength(1);
    expect(inserted[0].itemRef.kind).toBe('vocab');
    expect(inserted[0].itemRef.id.toString()).toBe(WORD_A);
    // Due immediately: the learner has just got it wrong.
    expect(inserted[0].due.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('pulls an existing card forward instead of inserting a duplicate', async () => {
    const later = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const { service, insertMany, updateMany } = buildScheduler({
      matched: [{ id: WORD_A, lemma: 'がっこう' }],
      existing: [{ id: WORD_A, due: later }],
    });

    const result = await service.scheduleMissedWords(USER_ID, ['がっこう']);

    expect(insertMany).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalled();
    expect(result.cardsAdvanced).toBe(99);
  });

  /**
   * The core promise of the design: `due` moves, the FSRS model does not. A
   * correction is not a graded review, and writing stability or difficulty from
   * one would feed the scheduler an observation that never happened.
   */
  it('touches only `due` — never stability, difficulty, state, reps or lapses', async () => {
    const later = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const { service, updateMany } = buildScheduler({
      matched: [{ id: WORD_A, lemma: 'がっこう' }],
      existing: [{ id: WORD_A, due: later }],
    });

    await service.scheduleMissedWords(USER_ID, ['がっこう']);

    const update = updateMany.mock.calls[0][1];
    expect(Object.keys(update.$set)).toEqual(['due']);
  });

  it('leaves an already-due card alone rather than writing the same date again', async () => {
    const past = new Date(Date.now() - 60_000);
    const { service, updateMany } = buildScheduler({
      matched: [{ id: WORD_A, lemma: 'がっこう' }],
      existing: [{ id: WORD_A, due: past }],
    });

    const result = await service.scheduleMissedWords(USER_ID, ['がっこう']);

    expect(updateMany).not.toHaveBeenCalled();
    expect(result).toEqual({ cardsCreated: 0, cardsAdvanced: 0 });
  });

  it('handles a turn that matched nothing without touching the database', async () => {
    const { service, insertMany, updateMany } = buildScheduler({ matched: [] });

    const result = await service.scheduleMissedWords(USER_ID, ['zzz']);

    expect(result).toEqual({ cardsCreated: 0, cardsAdvanced: 0 });
    expect(insertMany).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('creates and advances in the same turn when a correction touches both', async () => {
    const later = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const { service, insertMany } = buildScheduler({
      matched: [
        { id: WORD_A, lemma: 'がっこう' },
        { id: WORD_B, lemma: 'せんせい' },
      ],
      existing: [{ id: WORD_B, due: later }],
    });

    const result = await service.scheduleMissedWords(USER_ID, ['がっこ せんせい']);

    expect(result.cardsCreated).toBe(1);
    expect(result.cardsAdvanced).toBe(99);
    const inserted = insertMany.mock.calls[0][0] as { itemRef: { id: Types.ObjectId } }[];
    expect(inserted.map((d) => d.itemRef.id.toString())).toEqual([WORD_A]);
  });

  /**
   * A chat turn has already cost a provider call and been persisted by the time
   * this runs. Failing the request over a scheduling nicety would throw away the
   * learner's reply.
   */
  it('never throws — a scheduling failure must not cost the learner their reply', async () => {
    const { service, findVocabInTexts } = buildScheduler({
      matched: [{ id: WORD_A, lemma: 'がっこう' }],
    });
    findVocabInTexts.mockRejectedValueOnce(new Error('content is on fire'));

    await expect(service.scheduleMissedWords(USER_ID, ['がっこう'])).resolves.toEqual({
      cardsCreated: 0,
      cardsAdvanced: 0,
    });
  });

  it('also swallows a genuine write failure rather than surfacing it', async () => {
    const { service, insertMany } = buildScheduler({
      matched: [{ id: WORD_A, lemma: 'がっこう' }],
    });
    insertMany.mockRejectedValueOnce(new Error('mongo is on fire'));

    await expect(service.scheduleMissedWords(USER_ID, ['がっこう'])).resolves.toEqual({
      cardsCreated: 0,
      cardsAdvanced: 0,
    });
  });

  it('survives a lost insert race, counting only what landed', async () => {
    const { service, insertMany } = buildScheduler({
      matched: [
        { id: WORD_A, lemma: 'がっこう' },
        { id: WORD_B, lemma: 'せんせい' },
      ],
    });
    insertMany.mockRejectedValueOnce(
      Object.assign(new Error('dup'), { code: 11000, writeErrors: [{ err: { code: 11000 } }] }),
    );

    const result = await service.scheduleMissedWords(USER_ID, ['がっこう せんせい']);

    expect(result.cardsCreated).toBe(1);
  });
});

describe('LearningService.completeLesson — gems (slice 2)', () => {
  it('awards the full gem amount on a first completion', async () => {
    const { service, awardGems } = build({ timesCompleted: 1 });

    const result = await service.completeLesson(USER_ID, LESSON_ID);

    expect(awardGems).toHaveBeenCalledWith(USER_ID, GEMS_PER_LESSON_COMPLETION);
    expect(result.gemsAwarded).toBe(GEMS_PER_LESSON_COMPLETION);
  });

  /**
   * Gems mirror XP's anti-farming shape (#0): a replayed POST must not pay the
   * full award again, or the gem economy is free and the heart refill it exists
   * to gate becomes meaningless.
   */
  it('awards only the practice amount on a repeat, so gems cannot be farmed', async () => {
    const { service, awardGems } = build({ timesCompleted: 4 });

    const result = await service.completeLesson(USER_ID, LESSON_ID);

    expect(awardGems).toHaveBeenCalledWith(USER_ID, GEMS_PER_LESSON_PRACTICE);
    expect(result.gemsAwarded).toBe(GEMS_PER_LESSON_PRACTICE);
  });

  it('completes successfully even when the gem credit throws', async () => {
    const { service, awardGems } = build();
    awardGems.mockRejectedValueOnce(new Error('mongo is on fire'));

    // The cards and XP are already committed by this point; losing a gem credit
    // must not turn a successful completion into a 500.
    const result = await service.completeLesson(USER_ID, LESSON_ID);

    expect(result.cardsCreated).toBe(3);
    expect(result.xpAwarded).toBe(XP_PER_LESSON_COMPLETION);
  });

  it('reports gems on the analytics event', async () => {
    const { service, record } = build({ timesCompleted: 1 });

    await service.completeLesson(USER_ID, LESSON_ID);

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ gemsAwarded: GEMS_PER_LESSON_COMPLETION }),
      }),
    );
  });
});
