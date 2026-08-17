import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnalyticsService } from '../analytics/analytics.service';
import { ContentService } from '../content/content.service';
import { UserService } from '../user/user.service';
import { CheckpointAttemptsService } from './checkpoint-attempts.service';
import { ExerciseAttemptsService } from './exercise-attempts.service';
import { LearnerItemStateService } from './learner-item-state.service';
import { LearningService, XP_PER_LESSON_COMPLETION } from './learning.service';

const USER_ID = '607f1f77bcf86cd799439011';
const LESSON_ID = '507f1f77bcf86cd799439011';

function build(options: { clean?: boolean; attemptCount?: number; timesCompleted?: number } = {}) {
  const completion = {
    findOneAndUpdate: jest.fn(() => ({
      exec: () => Promise.resolve({ timesCompleted: options.timesCompleted ?? 1 }),
    })),
    find: jest.fn(() => ({
      select: () => ({ lean: () => ({ exec: () => Promise.resolve([]) }) }),
    })),
    deleteMany: jest.fn(() => ({ exec: () => Promise.resolve() })),
  };
  const awardXp = jest.fn(() => Promise.resolve({ gamification: { xp: 10 } }));
  const record = jest.fn(() => Promise.resolve());
  const addKnownKana = jest.fn(() => Promise.resolve());
  const attempts = {
    hasCleanAttemptForLesson: jest.fn(() => Promise.resolve(options.clean ?? true)),
    countAttemptsForLesson: jest.fn(() => Promise.resolve(options.attemptCount ?? 1)),
    deleteAllForUser: jest.fn(() => Promise.resolve()),
  };
  const service = new LearningService(
    completion as never,
    { collection: jest.fn(() => ({ deleteMany: jest.fn(() => Promise.resolve()) })) } as never,
    {
      findLessonById: jest.fn(() => Promise.resolve({
        id: LESSON_ID,
        title: 'First lesson',
        unit: 'hiragana-basics',
        prerequisiteLessonIds: [],
        items: [{ kind: 'kana', id: '507f1f77bcf86cd799439012', kana: 'あ' }],
      })),
      findLessons: jest.fn(() => Promise.resolve([])),
    } as unknown as ContentService,
    { awardXp, addKnownKana } as unknown as UserService,
    { record } as unknown as AnalyticsService,
    attempts as unknown as ExerciseAttemptsService,
    { deleteAllForUser: jest.fn(() => Promise.resolve()) } as unknown as LearnerItemStateService,
    { deleteAllForUser: jest.fn(() => Promise.resolve()) } as unknown as CheckpointAttemptsService,
    { get: jest.fn(() => 2) } as unknown as ConfigService,
  );
  return { service, awardXp, record, addKnownKana };
}

describe('LearningService.completeLesson without spaced review', () => {
  it('records completion, awards XP, and returns no scheduling fields', async () => {
    const { service, awardXp, record } = build();
    const result = await service.completeLesson(USER_ID, LESSON_ID);
    expect(result).toEqual({
      lessonId: LESSON_ID,
      title: 'First lesson',
      xpAwarded: XP_PER_LESSON_COMPLETION,
      firstCompletion: true,
      totalXp: 10,
    });
    expect(awardXp).toHaveBeenCalledWith(USER_ID, XP_PER_LESSON_COMPLETION);
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ type: 'lesson.completed' }));
  });

  it('adds taught kana on first completion', async () => {
    const { service, addKnownKana } = build();
    await service.completeLesson(USER_ID, LESSON_ID);
    expect(addKnownKana).toHaveBeenCalledWith(USER_ID, ['あ']);
  });

  it('uses the smaller practice award on a repeat completion', async () => {
    const { service, awardXp } = build({ timesCompleted: 2 });
    const result = await service.completeLesson(USER_ID, LESSON_ID);
    expect(result.firstCompletion).toBe(false);
    expect(result.xpAwarded).toBe(2);
    expect(awardXp).toHaveBeenCalledWith(USER_ID, 2);
  });

  it('refuses completion until every exercise is correct', async () => {
    const { service } = build({ clean: false, attemptCount: 2 });
    await expect(service.completeLesson(USER_ID, LESSON_ID)).rejects.toBeInstanceOf(ConflictException);
  });
});
