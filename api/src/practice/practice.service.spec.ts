import { UnprocessableEntityException } from '@nestjs/common';
import { Types } from 'mongoose';
import { PracticeService } from './practice.service';

const USER_ID = '607f1f77bcf86cd799439011';
const LESSONS = [
  { id: '507f1f77bcf86cd799439011', lang: 'ja', unit: 'vocab-n5', order: 0, title: 'Words', exerciseTypes: ['multipleChoice'], itemCount: 1, prerequisiteLessonIds: [] },
  { id: '507f1f77bcf86cd799439012', lang: 'ja', unit: 'kanji-n5', order: 0, title: 'Kanji', exerciseTypes: ['multipleChoice'], itemCount: 1, prerequisiteLessonIds: [] },
  { id: '507f1f77bcf86cd799439013', lang: 'ja', unit: 'grammar-n5', order: 0, title: 'Grammar', exerciseTypes: ['multipleChoice'], itemCount: 1, prerequisiteLessonIds: [] },
  { id: '507f1f77bcf86cd799439014', lang: 'ja', unit: 'marks-words', order: 0, title: 'Readings', exerciseTypes: ['wordReading'], itemCount: 1, prerequisiteLessonIds: [] },
] as const;

function questionFor(lessonId: string) {
  const lesson = LESSONS.find((entry) => entry.id === lessonId)!;
  const kind = lesson.unit.startsWith('kanji') ? 'kanji'
    : lesson.unit.startsWith('grammar') ? 'grammar'
      : lesson.exerciseTypes.includes('wordReading') ? 'wordReading'
        : 'vocab';
  const typed = kind === 'wordReading';
  return {
    lessonId,
    unit: lesson.unit,
    title: lesson.title,
    attempt: 1,
    questionCount: 1,
    questions: [{
      exerciseId: '1:0',
      itemId: new Types.ObjectId().toString(),
      type: typed ? 'wordReading' : 'multipleChoice',
      prompt: typed ? 'がっこう' : kind === 'kanji' ? '山' : kind === 'grammar' ? 'わたし＿学生です' : 'ねこ',
      promptKind: kind,
      question: 'Apply what you know',
      ...(typed ? {} : { options: [{ id: 'opt-0', value: 'one' }, { id: 'opt-1', value: 'two' }] }),
    }],
  };
}

function harness(weak: unknown[] = []) {
  let stored: any = null;
  const model = {
    create: jest.fn(async (value) => {
      stored = value;
      return value;
    }),
    findOne: jest.fn(() => ({ exec: async () => stored })),
    findOneAndUpdate: jest.fn((_filter, update) => ({
      exec: async () => {
        const answer = update.$push.answers;
        stored = {
          ...stored,
          answers: [...stored.answers, answer],
          score: stored.score + update.$inc.score,
          maxCombo: Math.max(stored.maxCombo, update.$max.maxCombo),
        };
        return stored;
      },
    })),
  };
  const content = {
    findLessons: jest.fn(async () => [...LESSONS]),
    findLessonsContainingItems: jest.fn(async () => []),
  };
  const exercise = {
    generate: jest.fn(async (lessonId: string) => questionFor(lessonId)),
    answer: jest.fn(async () => ({
      exerciseId: '1:0', correct: true, selectedOptionId: 'opt-0', selectedValue: 'one',
      correctOptionId: 'opt-0', correctValue: 'one', prompt: 'ねこ',
    })),
  };
  const learner = { findWeakestForUser: jest.fn(async () => weak) };
  const users = { awardXp: jest.fn() };
  const service = new PracticeService(model as never, content as never, exercise as never, learner as never, users as never);
  return { service, model, exercise, getStored: () => stored };
}

describe('PracticeService', () => {
  it('interleaves real generated skills without putting answer keys in questions', async () => {
    const { service, model } = harness();
    const session = await service.create(USER_ID, {
      mode: 'mixed',
      questionCount: 5,
      skills: ['vocabulary', 'kanji', 'grammar', 'reading'],
    });

    expect(model.create).toHaveBeenCalledTimes(1);
    expect(new Set(session.questions.map((question: any) => question.skill))).toEqual(
      new Set(['vocabulary', 'kanji', 'grammar', 'reading']),
    );
    expect(new Set(session.questions.map((question: any) => question.type))).toEqual(
      new Set(['multipleChoice', 'wordReading']),
    );
    for (const question of session.questions) {
      expect(question).not.toHaveProperty('correctValue');
      expect(question).not.toHaveProperty('correctOptionId');
    }
  });

  it('does not fabricate Weak Areas before the learner has evidence', async () => {
    const { service } = harness([]);
    await expect(service.create(USER_ID, { mode: 'weak' })).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('grades Practice with the scheduler-independent source context', async () => {
    const { service, exercise } = harness();
    const created = await service.create(USER_ID, { mode: 'mixed', questionCount: 5 });
    const first = created.questions[0];

    await service.answer(USER_ID, created.id, first.id, {
      optionId: 'opt-0',
      responseTimeMs: 850,
    });

    expect(exercise.answer).toHaveBeenCalledWith(
      first.lessonId,
      first.exerciseId,
      USER_ID,
      expect.objectContaining({ sourceContext: 'practice', responseTimeMs: 850 }),
    );
  });
});
