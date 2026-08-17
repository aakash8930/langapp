import { BadRequestException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  CheckpointAttemptsService,
  COMBINED_UNIT_PREFIX,
} from '../../learning/checkpoint-attempts.service';
import { LearnerItemStateService } from '../../learning/learner-item-state.service';
import { LearningService } from '../../learning/learning.service';
import {
  CheckpointQuestion,
  UnitCheckpointAttemptDocument,
} from '../../learning/schemas/unit-checkpoint-attempt.schema';
import { UserService } from '../../user/user.service';
import { ContentService, UnitContent } from '../content.service';
import { ResolvedItem } from '../dto/lesson-response.dto';
import {
  CombinedTestService,
  COMBINED_QUESTION_COUNT,
  XP_PER_COMBINED_PASS,
  XP_PER_COMBINED_REPEAT,
} from './combined-test.service';

const USER_ID = '607f1f77bcf86cd799439011';
const UNIT_A = 'hiragana-basics';
const UNIT_B = 'katakana-basics';

function kanaItem(index: number): ResolvedItem {
  return {
    kind: 'kana',
    id: new Types.ObjectId().toString(),
    kana: `character-${index}`,
    romaji: `romaji-${index}`,
    script: 'hiragana',
    row: 'a',
    order: index,
  } as ResolvedItem;
}

function unitContent(unit: string, items: ResolvedItem[], exerciseTypes = ['multipleChoice']): UnitContent {
  return { unit, lessonIds: ['507f1f77bcf86cd799439011'], items, exerciseTypes };
}

/**
 * An in-memory stand-in for `CheckpointAttemptsService`.
 *
 * Same trade-off as the per-unit spec: the one-shot and exactly-once rules
 * live in the Mongo query filters, so a mock that always returned `true`
 * would test nothing.
 */
class FakeAttempts {
  rows: (UnitCheckpointAttemptDocument & { unitSlugs: string[]; kind: 'unit' | 'combined' })[] = [];

  findOpen = jest.fn((userId: string, unit: string) =>
    Promise.resolve(
      this.rows.find(
        (row) => row.userId.toString() === userId && row.unit === unit && row.submittedAt === null,
      ) ?? null,
    ),
  );

  findAttempt = jest.fn((userId: string, unit: string, attempt: number) =>
    Promise.resolve(
      this.rows.find(
        (row) =>
          row.userId.toString() === userId && row.unit === unit && row.attempt === attempt,
      ) ?? null,
    ),
  );

  create = jest.fn(
    (
      userId: string,
      unit: string,
      questions: CheckpointQuestion[],
      options: { kind?: 'unit' | 'combined'; unitSlugs?: string[] } = {},
    ) => {
      const highest = this.rows
        .filter((row) => row.userId.toString() === userId && row.unit === unit)
        .reduce((max, row) => Math.max(max, row.attempt), 0);

      const row = {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(userId),
        unit,
        attempt: highest + 1,
        questions,
        submittedAt: null,
        score: null,
        passed: null,
        kind: options.kind ?? 'unit',
        unitSlugs: options.unitSlugs ?? [],
      } as unknown as UnitCheckpointAttemptDocument & { unitSlugs: string[]; kind: 'unit' | 'combined' };

      this.rows.push(row);
      return Promise.resolve(row);
    },
  );

  recordAnswer = jest.fn(
    (attemptId: Types.ObjectId, exerciseId: string, correct: boolean, responseTimeMs?: number) => {
      const row = this.rows.find((r) => r._id.equals(attemptId));
      if (!row || row.submittedAt !== null) return Promise.resolve(false);

      const question = row.questions.find((q) => q.exerciseId === exerciseId);
      if (!question || question.answered) return Promise.resolve(false);

      question.answered = true;
      question.correct = correct;
      question.responseTimeMs = responseTimeMs ?? null;
      return Promise.resolve(true);
    },
  );

  submit = jest.fn((attemptId: Types.ObjectId, score: number, passed: boolean) => {
    const row = this.rows.find((r) => r._id.equals(attemptId));
    if (!row || row.submittedAt !== null) return Promise.resolve(false);

    row.submittedAt = new Date();
    row.score = score;
    row.passed = passed;
    return Promise.resolve(true);
  });

  hasPassedCombined = jest.fn((userId: string) =>
    Promise.resolve(
      this.rows.some(
        (row) =>
          row.userId.toString() === userId && row.kind === 'combined' && row.passed === true,
      ),
    ),
  );

  combinedUnitMarker = jest.fn((unitSlugs: readonly string[]) => {
    const sorted = [...unitSlugs].sort().join(',');
    return `${COMBINED_UNIT_PREFIX}${sorted}`;
  });

  deleteAllForUser = jest.fn(() => Promise.resolve());
}

function build(opts: {
  finishedUnits?: string[];
  unitItems?: Record<string, ResolvedItem[]>;
  exerciseTypes?: string[];
  evidence?: Map<string, { confidence: number; exposures: number }>;
} = {}) {
  const finishedUnits = opts.finishedUnits ?? [UNIT_A, UNIT_B];
  const unitItems = opts.unitItems ?? {
    [UNIT_A]: Array.from({ length: 5 }, (_, i) => kanaItem(i)),
    [UNIT_B]: Array.from({ length: 5 }, (_, i) => kanaItem(100 + i)),
  };
  const exerciseTypes = opts.exerciseTypes ?? ['multipleChoice'];

  const attempts = new FakeAttempts();

  const findUnitContent = jest.fn((unit: string) =>
    Promise.resolve(unitContent(unit, unitItems[unit] ?? [], exerciseTypes)),
  );
  const listFinishedUnitSlugs = jest.fn(() => Promise.resolve(finishedUnits));
  const findLessons = jest.fn(() => Promise.resolve([]));

  const findEvidenceForItems = jest.fn(() => Promise.resolve(opts.evidence ?? new Map()));
  const recordLearnerItem = jest.fn(() => Promise.resolve());
  const scheduleItemDue = jest.fn(() =>
    Promise.resolve({ cardCreated: false, cardAdvanced: true }),
  );
  const awardXp = jest.fn(() => Promise.resolve({} as never));

  const contentService = {
    findUnitContent,
    findLessons,
  } as unknown as ContentService;

  const learningService = {
    listFinishedUnitSlugs,
    scheduleItemDue,
  } as unknown as LearningService;

  const service = new CombinedTestService(
    contentService,
    attempts as unknown as CheckpointAttemptsService,
    {
      findEvidenceForItems,
      record: recordLearnerItem,
    } as unknown as LearnerItemStateService,
    learningService,
    { awardXp } as unknown as UserService,
  );

  return {
    service,
    attempts,
    findUnitContent,
    listFinishedUnitSlugs,
    recordLearnerItem,
    scheduleItemDue,
    awardXp,
  };
}

async function answerAll(
  service: CombinedTestService,
  attempts: FakeAttempts,
  correctCount: number,
  attempt: number = attempts.rows[0].attempt,
): Promise<void> {
  const row = attempts.rows.find((r) => r.attempt === attempt);
  if (!row) throw new Error(`No attempt ${attempt}`);
  for (const [index, question] of row.questions.entries()) {
    const optionId =
      index < correctCount
        ? question.correctOptionId
        : question.options.find((o) => o.id !== question.correctOptionId)?.id;

    await service.answer(row.attempt, question.exerciseId, USER_ID, { optionId });
  }
}

describe('CombinedTestService.start', () => {
  it('422s when the learner has fewer than two finished units', async () => {
    const { service } = build({ finishedUnits: [UNIT_A] });

    await expect(service.start(USER_ID)).rejects.toThrow(UnprocessableEntityException);
  });

  it('returns the public set without the answer key', async () => {
    const { service } = build();

    const set = await service.start(USER_ID);

    expect(set.kind).toBe('combined');
    expect(set.unitSlugs).toEqual([UNIT_A, UNIT_B]);
    for (const question of set.questions) {
      expect(question).not.toHaveProperty('correctOptionId');
      expect(question).not.toHaveProperty('correctValue');
    }
  });

  it('uses a combined:<marker> on the stored attempt and persists unitSlugs', async () => {
    const { service, attempts } = build();

    await service.start(USER_ID);

    expect(attempts.rows).toHaveLength(1);
    expect(attempts.rows[0].unit.startsWith(COMBINED_UNIT_PREFIX)).toBe(true);
    expect(attempts.rows[0].kind).toBe('combined');
    expect(attempts.rows[0].unitSlugs).toEqual([UNIT_A, UNIT_B]);
  });

  it('caps the set at COMBINED_QUESTION_COUNT even when the union is much bigger', async () => {
    const { service } = build({
      unitItems: {
        [UNIT_A]: Array.from({ length: 300 }, (_, i) => kanaItem(i)),
        [UNIT_B]: Array.from({ length: 300 }, (_, i) => kanaItem(1000 + i)),
      },
    });

    const set = await service.start(USER_ID);

    expect(set.questionCount).toBe(COMBINED_QUESTION_COUNT);
  });

  it('deduplicates the union by (kind, id) — a future content drift would re-ask the same item', async () => {
    // An item present in both finished units should only appear once.
    const shared = kanaItem(0);
    const { service } = build({
      unitItems: {
        [UNIT_A]: [shared, kanaItem(1)],
        [UNIT_B]: [shared, kanaItem(2)],
      },
    });

    const set = await service.start(USER_ID);

    const ids = set.questions.map((q) => q.itemId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('resumes the open attempt instead of generating a second one', async () => {
    const { service, attempts } = build();

    const first = await service.start(USER_ID);
    const second = await service.start(USER_ID);

    expect(attempts.rows).toHaveLength(1);
    expect(second.attempt).toBe(first.attempt);
  });

  it('issues a fresh attempt when a new unit is finished between starts', async () => {
    const { service, attempts, listFinishedUnitSlugs } = build();
    await service.start(USER_ID);

    listFinishedUnitSlugs.mockResolvedValueOnce([UNIT_A, UNIT_B, 'vocab-basics']);
    const second = await service.start(USER_ID);

    expect(attempts.rows).toHaveLength(2);
    expect(second.attempt).toBe(1);
    expect(attempts.rows[1].unitSlugs).toEqual([UNIT_A, UNIT_B, 'vocab-basics']);
  });
});

describe('CombinedTestService.answer', () => {
  it('withholds the right answer mid-test, like the per-unit checkpoint does', async () => {
    const { service } = build();
    const set = await service.start(USER_ID);
    const first = set.questions[0];

    const result = await service.answer(set.attempt, first.exerciseId, USER_ID, {
      optionId: first.options![0].id,
    });

    expect(result.correctValue).toBe('');
    expect(result.correctOptionId).toBe('');
  });

  it('tags learner-model evidence with sourceContext "combined", not "checkpoint"', async () => {
    const { service, recordLearnerItem } = build();
    const set = await service.start(USER_ID);
    const first = set.questions[0];

    await service.answer(set.attempt, first.exerciseId, USER_ID, {
      optionId: first.options![0].id,
    });

    expect(recordLearnerItem).toHaveBeenCalledWith(
      expect.objectContaining({ sourceContext: 'combined' }),
    );
  });

  it('404s an attempt that does not exist', async () => {
    const { service } = build();

    await expect(
      service.answer(99, '1:0', USER_ID, { optionId: 'opt-0' }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('CombinedTestService.submit', () => {
  it('passes at the pass mark and awards the full XP the first time', async () => {
    const { service, attempts, awardXp } = build();
    const set = await service.start(USER_ID);

    await answerAll(service, attempts, set.questionCount);
    const result = await service.submit(set.attempt, USER_ID);

    expect(result.passed).toBe(true);
    expect(result.xpAwarded).toBe(XP_PER_COMBINED_PASS);
    expect(awardXp).toHaveBeenCalledWith(USER_ID, XP_PER_COMBINED_PASS);
  });

  it('awards the smaller repeat XP on a second pass', async () => {
    const { service, attempts, awardXp } = build();
    const first = await service.start(USER_ID);
    await answerAll(service, attempts, first.questionCount, first.attempt);
    await service.submit(first.attempt, USER_ID);

    // Same finished set, same marker — a previously-passed attempt does not
    // make `start` return the closed row. It issues attempt 2.
    const second = await service.start(USER_ID);
    expect(second.attempt).toBe(2);

    await answerAll(service, attempts, second.questionCount, second.attempt);
    const result = await service.submit(second.attempt, USER_ID);

    expect(result.passed).toBe(true);
    expect(result.xpAwarded).toBe(XP_PER_COMBINED_REPEAT);

    // First pass paid the full award, second pass paid the repeat one — and
    // nothing else.
    expect(awardXp).toHaveBeenCalledTimes(2);
    expect(awardXp).toHaveBeenNthCalledWith(1, USER_ID, XP_PER_COMBINED_PASS);
    expect(awardXp).toHaveBeenNthCalledWith(2, USER_ID, XP_PER_COMBINED_REPEAT);
  });

  it('awards XP exactly once however many times submit is called', async () => {
    const { service, attempts, awardXp } = build();
    const set = await service.start(USER_ID);
    await answerAll(service, attempts, set.questionCount);

    await service.submit(set.attempt, USER_ID);
    await service.submit(set.attempt, USER_ID);

    expect(awardXp).toHaveBeenCalledTimes(1);
  });


  it('fails below the pass mark and awards nothing', async () => {
    const { service, attempts, awardXp } = build();
    const set = await service.start(USER_ID);

    await answerAll(service, attempts, 1);
    const result = await service.submit(set.attempt, USER_ID);

    expect(result.passed).toBe(false);
    expect(result.xpAwarded).toBe(0);
    expect(awardXp).not.toHaveBeenCalled();
  });

  it('refuses to answer a submitted attempt', async () => {
    const { service, attempts } = build();
    const set = await service.start(USER_ID);
    await answerAll(service, attempts, set.questionCount);
    await service.submit(set.attempt, USER_ID);

    await expect(
      service.answer(set.attempt, set.questions[0].exerciseId, USER_ID, {
        optionId: set.questions[0].options![0].id,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
