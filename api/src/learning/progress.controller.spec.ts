import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { AnalyticsService } from '../analytics/analytics.service';
import { AuthenticatedUser } from '../common/auth/jwt-auth.guard';
import { UserService } from '../user/user.service';
import { CheckpointAttemptsService } from './checkpoint-attempts.service';
import { LearningService } from './learning.service';
import { ProgressController } from './progress.controller';

const USER_ID = '607f1f77bcf86cd799439011';
const CURRENT = { userId: USER_ID } as AuthenticatedUser;

function makeUser() {
  return {
    gamification: { xp: 120, streakDays: 3, lastStudyDate: '2026-07-29', dailyGoalXp: 50 },
    settings: { tz: 'Asia/Kolkata' },
  };
}

/**
 * Stubbed models rather than a real Mongo, matching the other specs in this
 * module. What is under test is the controller's assembly of the payload, not
 * Mongoose.
 */
function makeController(overrides: { passedUnits?: string[]; user?: unknown } = {}) {
  const user = 'user' in overrides ? overrides.user : makeUser();

  const userService = {
    findById: jest.fn().mockResolvedValue(user),
    todayXpFor: jest.fn().mockReturnValue(20),
  } as unknown as UserService;

  const learningService = {
    findCompletedLessonIds: jest.fn().mockResolvedValue(['lesson-a', 'lesson-b']),
  } as unknown as LearningService;



  const analyticsService = {
    countTodayByType: jest.fn().mockResolvedValue({ 'lesson.completed': 1 }),
  } as unknown as AnalyticsService;

  const checkpointAttempts = {
    passedUnits: jest.fn().mockResolvedValue(overrides.passedUnits ?? []),
  } as unknown as CheckpointAttemptsService;

  return {
    controller: new ProgressController(
      userService,
      learningService,
      analyticsService,
      checkpointAttempts,
    ),
    checkpointAttempts,
  };
}

describe('ProgressController — passedUnits', () => {
  it('reports the units the learner has passed a checkpoint on', async () => {
    const { controller } = makeController({
      passedUnits: ['hiragana-basics', 'katakana-basics'],
    });

    const result = await controller.progress(CURRENT);

    expect(result.passedUnits).toEqual(['hiragana-basics', 'katakana-basics']);
  });

  it('is an empty array, never undefined, for a learner who has passed nothing', async () => {
    // A client ticking a unit list will iterate this unguarded, so the field
    // has to exist on every response rather than be absent when empty.
    const { controller } = makeController({ passedUnits: [] });

    const result = await controller.progress(CURRENT);

    expect(result.passedUnits).toEqual([]);
  });

  it('carries unit slugs, keeping it distinct from the lesson ids beside it', async () => {
    const { controller } = makeController({ passedUnits: ['hiragana-basics'] });

    const result = await controller.progress(CURRENT);

    // The two live next to each other and are not interchangeable: slugs here,
    // Mongo ids there. A client that crosses them silently ticks nothing.
    expect(result.passedUnits).toEqual(['hiragana-basics']);
    expect(result.completedLessonIds).toEqual(['lesson-a', 'lesson-b']);
  });

  it('does not disturb the rest of the payload', async () => {
    const { controller } = makeController({ passedUnits: ['hiragana-basics'] });

    const result = await controller.progress(CURRENT);

    expect(result.xp).toBe(120);
    expect(result.streakDays).toBe(3);
    expect(result.lessonsCompleted).toBe(2);
    expect(result.daily.xpToday).toBe(20);
    expect(result.daily.lessonsDone).toBe(1);
  });

  it('does not query checkpoints for an account that is gone', async () => {
    const { controller, checkpointAttempts } = makeController({ user: null });

    await expect(controller.progress(CURRENT)).rejects.toBeInstanceOf(NotFoundException);
    expect(checkpointAttempts.passedUnits).not.toHaveBeenCalled();
  });
});

/**
 * `passedUnits` shipped with the checkpoint and was called by nothing until
 * /me/progress picked it up, so it reached a route untested.
 */
describe('CheckpointAttemptsService.passedUnits', () => {
  function makeService(rows: { unit: string }[]) {
    const find = jest.fn().mockReturnValue({
      select: () => ({ lean: () => ({ exec: () => Promise.resolve(rows) }) }),
    });

    const service = new CheckpointAttemptsService({ find } as never);
    return { service, find };
  }

  it('asks only for passed per-unit attempts, scoped to the one learner', async () => {
    // `passedUnits` is the unit list on `/me/progress`, and combined-test
    // passes are a different axis — not units, so they must not appear here.
    // The `kind: 'unit'` filter is what enforces that.
    const { service, find } = makeService([]);

    await service.passedUnits(USER_ID);

    expect(find).toHaveBeenCalledWith({
      userId: new Types.ObjectId(USER_ID),
      passed: true,
      kind: 'unit',
    });
  });

  it('deduplicates a unit passed more than once', async () => {
    // Retaking a passed unit is allowed and awards the smaller repeat XP, so
    // several passed rows for one unit is the normal case, not an edge one.
    const { service } = makeService([
      { unit: 'hiragana-basics' },
      { unit: 'hiragana-basics' },
      { unit: 'katakana-basics' },
    ]);

    expect(await service.passedUnits(USER_ID)).toEqual(['hiragana-basics', 'katakana-basics']);
  });

  it('sorts, so the response does not reorder between reads', async () => {
    const { service } = makeService([
      { unit: 'katakana-basics' },
      { unit: 'hiragana-basics' },
    ]);

    expect(await service.passedUnits(USER_ID)).toEqual(['hiragana-basics', 'katakana-basics']);
  });
});
