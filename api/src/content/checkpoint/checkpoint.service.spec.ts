import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { CheckpointAttemptsService, CHECKPOINT_PASS_MARK } from '../../learning/checkpoint-attempts.service';
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
  CheckpointService,
  CHECKPOINT_QUESTION_COUNT,
  XP_PER_CHECKPOINT_PASS,
  XP_PER_CHECKPOINT_REPEAT,
} from './checkpoint.service';

const USER_ID = '607f1f77bcf86cd799439011';
const UNIT = 'hiragana-basics';

function kanaItem(index: number): ResolvedItem {
  // Distinct romaji per item: `assembleOptions` dedupes distractors by answer
  // text, so repeated answers would silently shrink the option count.
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

function vocabItem(index: number): ResolvedItem {
  return {
    kind: 'vocab',
    id: new Types.ObjectId().toString(),
    lemma: `word-${index}`,
    reading: `word-${index}`,
    romaji: `yomi${index}`,
    gloss: `meaning-${index}`,
    pos: 'noun',
    jlpt: 'N5',
  } as ResolvedItem;
}

function unitContent(items: ResolvedItem[], exerciseTypes = ['multipleChoice']): UnitContent {
  return { unit: UNIT, lessonIds: ['507f1f77bcf86cd799439011'], items, exerciseTypes };
}

/**
 * An in-memory stand-in for `CheckpointAttemptsService`.
 *
 * Real enough to exercise the rules that live in the query filters rather than
 * in the service — one-shot answers and exactly-once submit are both enforced
 * by `updateOne` conditions, so a mock that just returned `true` would test
 * nothing and hide the two defects those filters exist to prevent.
 */
class FakeAttempts {
  rows: UnitCheckpointAttemptDocument[] = [];

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

  create = jest.fn((userId: string, unit: string, questions: CheckpointQuestion[]) => {
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
    } as unknown as UnitCheckpointAttemptDocument;

    this.rows.push(row);
    return Promise.resolve(row);
  });

  recordAnswer = jest.fn(
    (attemptId: Types.ObjectId, exerciseId: string, correct: boolean, responseTimeMs?: number) => {
      const row = this.rows.find((r) => r._id.equals(attemptId));
      if (!row || row.submittedAt !== null) return Promise.resolve(false);

      const question = row.questions.find((q) => q.exerciseId === exerciseId);
      // The `answered: false` clause of the real query — the one-shot rule.
      if (!question || question.answered) return Promise.resolve(false);

      question.answered = true;
      question.correct = correct;
      question.responseTimeMs = responseTimeMs ?? null;
      return Promise.resolve(true);
    },
  );

  submit = jest.fn((attemptId: Types.ObjectId, score: number, passed: boolean) => {
    const row = this.rows.find((r) => r._id.equals(attemptId));
    // The `submittedAt: null` clause — what makes the XP exactly-once.
    if (!row || row.submittedAt !== null) return Promise.resolve(false);

    row.submittedAt = new Date();
    row.score = score;
    row.passed = passed;
    return Promise.resolve(true);
  });

  hasPassed = jest.fn((userId: string, unit: string) =>
    Promise.resolve(
      this.rows.some(
        (row) => row.userId.toString() === userId && row.unit === unit && row.passed === true,
      ),
    ),
  );

  deleteAllForUser = jest.fn(() => Promise.resolve());
}

function build(
  opts: {
    items?: ResolvedItem[];
    exerciseTypes?: string[];
    /** itemId → confidence, for the weakness ranking. */
    evidence?: Map<string, { confidence: number; exposures: number }>;
  } = {},
) {
  const items = opts.items ?? Array.from({ length: 5 }, (_, i) => kanaItem(i));
  const attempts = new FakeAttempts();
  const findUnitContent = jest.fn(() =>
    Promise.resolve(unitContent(items, opts.exerciseTypes)),
  );
  const findEvidenceForItems = jest.fn(() => Promise.resolve(opts.evidence ?? new Map()));
  const recordLearnerItem = jest.fn(() => Promise.resolve());
  const scheduleItemDue = jest.fn(() =>
    Promise.resolve({ cardCreated: false, cardAdvanced: true }),
  );
  const awardXp = jest.fn(() => Promise.resolve({} as never));

  const service = new CheckpointService(
    { findUnitContent } as unknown as ContentService,
    attempts as unknown as CheckpointAttemptsService,
    {
      findEvidenceForItems,
      record: recordLearnerItem,
    } as unknown as LearnerItemStateService,
    { scheduleItemDue } as unknown as LearningService,
    { awardXp } as unknown as UserService,
  );

  return { service, attempts, findUnitContent, recordLearnerItem, scheduleItemDue, awardXp, items };
}

/** Answer every question in the stored attempt, `correctCount` of them right. */
async function answerAll(
  service: CheckpointService,
  attempts: FakeAttempts,
  correctCount: number,
): Promise<void> {
  const row = attempts.rows[0];
  for (const [index, question] of row.questions.entries()) {
    const optionId =
      index < correctCount
        ? question.correctOptionId
        : question.options.find((o) => o.id !== question.correctOptionId)?.id;

    await service.answer(UNIT, row.attempt, question.exerciseId, USER_ID, { optionId });
  }
}

describe('CheckpointService.start', () => {
  it('404s a unit that has no lessons', async () => {
    const { service, findUnitContent } = build();
    findUnitContent.mockResolvedValueOnce({
      unit: 'nope',
      lessonIds: [],
      items: [],
      exerciseTypes: [],
    });

    await expect(service.start('nope', USER_ID)).rejects.toThrow(NotFoundException);
  });

  it('never sends the answer key', async () => {
    const { service } = build();

    const set = await service.start(UNIT, USER_ID);

    for (const question of set.questions) {
      expect(question).not.toHaveProperty('correctOptionId');
      expect(question).not.toHaveProperty('correctValue');
      expect(question).not.toHaveProperty('correct');
      expect(question).not.toHaveProperty('answered');
    }
  });

  it('caps the set at CHECKPOINT_QUESTION_COUNT however big the unit is', async () => {
    // vocab-n5 is 512 items across 32 lessons. Nobody sits a 512-question test.
    const { service } = build({ items: Array.from({ length: 200 }, (_, i) => kanaItem(i)) });

    const set = await service.start(UNIT, USER_ID);

    expect(set.questionCount).toBe(CHECKPOINT_QUESTION_COUNT);
    expect(set.questions).toHaveLength(CHECKPOINT_QUESTION_COUNT);
  });

  it('asks every item when the unit is smaller than the cap', async () => {
    // hiragana-marks-extra is 6 items. The cap is a maximum, not a quota.
    const { service } = build({ items: Array.from({ length: 6 }, (_, i) => kanaItem(i)) });

    const set = await service.start(UNIT, USER_ID);

    expect(set.questionCount).toBe(6);
  });

  it('resumes the open attempt instead of generating a second one', async () => {
    // This is the re-roll guard: a learner who dislikes their questions must
    // not be able to abandon the attempt and get an easier draw.
    const { service, attempts } = build();

    const first = await service.start(UNIT, USER_ID);
    const second = await service.start(UNIT, USER_ID);

    expect(second.attempt).toBe(first.attempt);
    expect(second.questions.map((q) => q.itemId)).toEqual(first.questions.map((q) => q.itemId));
    expect(attempts.create).toHaveBeenCalledTimes(1);
  });

  it('issues the next attempt number once the previous one is submitted', async () => {
    const { service } = build();

    const first = await service.start(UNIT, USER_ID);
    await service.submit(UNIT, first.attempt, USER_ID);
    const second = await service.start(UNIT, USER_ID);

    expect(first.attempt).toBe(1);
    expect(second.attempt).toBe(2);
  });

  it('prefers the learner’s weakest items over ones they know', async () => {
    // The whole point of weighting: a checkpoint that drew at random would
    // mostly re-test items already mastered.
    const items = Array.from({ length: 30 }, (_, i) => kanaItem(i));
    const weak = items.slice(0, 5);
    const evidence = new Map(
      items.map((item, index) => [
        `kana:${item.id}`,
        // The first five are shaky, the rest are solid.
        { confidence: index < 5 ? 0.1 : 0.95, exposures: 10 },
      ]),
    );
    const { service } = build({ items, evidence });

    const set = await service.start(UNIT, USER_ID);

    const asked = new Set(set.questions.map((q) => q.itemId));
    for (const item of weak) {
      expect(asked.has(item.id)).toBe(true);
    }
  });

  it('ranks never-seen items above well-known ones', async () => {
    // "Never practised" is not "practised badly", but it is the next most
    // useful thing to test — and a learner who skipped ahead should be caught.
    const items = Array.from({ length: 25 }, (_, i) => kanaItem(i));
    const unseen = items.slice(0, 3);
    const evidence = new Map(
      items
        .slice(3)
        .map((item) => [`kana:${item.id}`, { confidence: 0.95, exposures: 10 }]),
    );
    const { service } = build({ items, evidence });

    const set = await service.start(UNIT, USER_ID);

    const asked = new Set(set.questions.map((q) => q.itemId));
    for (const item of unseen) {
      expect(asked.has(item.id)).toBe(true);
    }
  });
});

describe('CheckpointService.answer', () => {
  it('does not reveal the right answer mid-test', async () => {
    // Showing it would turn any later question about the same item into a
    // lookup. The key is released at submit, which is where a test may teach.
    const { service, attempts } = build();
    await service.start(UNIT, USER_ID);
    const question = attempts.rows[0].questions[0];

    const result = await service.answer(UNIT, 1, question.exerciseId, USER_ID, {
      optionId: question.options.find((o) => o.id !== question.correctOptionId)?.id,
    });

    expect(result.correct).toBe(false);
    expect(result.correctOptionId).toBe('');
    expect(result.correctValue).toBe('');
  });

  it('takes the first answer only', async () => {
    // A test that lets you retry until the light goes green measures nothing.
    const { service, attempts } = build();
    await service.start(UNIT, USER_ID);
    const question = attempts.rows[0].questions[0];
    const wrong = question.options.find((o) => o.id !== question.correctOptionId)!.id;

    const first = await service.answer(UNIT, 1, question.exerciseId, USER_ID, { optionId: wrong });
    const second = await service.answer(UNIT, 1, question.exerciseId, USER_ID, {
      optionId: question.correctOptionId,
    });

    expect(first.correct).toBe(false);
    // The second call reports the stored verdict rather than 400ing: a
    // double-tap is not an error, it just cannot overwrite.
    expect(second.correct).toBe(false);
    expect(attempts.rows[0].questions[0].correct).toBe(false);
  });

  it('records learner-model evidence once, tagged as a checkpoint', async () => {
    const { service, attempts, recordLearnerItem } = build();
    await service.start(UNIT, USER_ID);
    const question = attempts.rows[0].questions[0];

    await service.answer(UNIT, 1, question.exerciseId, USER_ID, {
      optionId: question.correctOptionId,
      responseTimeMs: 3300,
    });
    await service.answer(UNIT, 1, question.exerciseId, USER_ID, {
      optionId: question.correctOptionId,
    });

    expect(recordLearnerItem).toHaveBeenCalledTimes(1);
    expect(recordLearnerItem).toHaveBeenCalledWith(
      expect.objectContaining({
        itemRef: { kind: 'kana', id: question.itemId },
        outcome: { correct: true, responseTimeMs: 3300 },
        sourceContext: 'checkpoint',
        exerciseType: 'multipleChoice',
      }),
    );
  });

  it('rejects a typed answer to a multiple-choice question', async () => {
    const { service, attempts } = build();
    await service.start(UNIT, USER_ID);
    const question = attempts.rows[0].questions[0];

    await expect(
      service.answer(UNIT, 1, question.exerciseId, USER_ID, { text: 'a' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('grades a typed answer with the same normalisation the lessons use', async () => {
    const { service, attempts } = build({
      items: Array.from({ length: 4 }, (_, i) => vocabItem(i)),
      exerciseTypes: ['wordReading'],
    });
    await service.start(UNIT, USER_ID);
    const question = attempts.rows[0].questions[0];

    const result = await service.answer(UNIT, 1, question.exerciseId, USER_ID, {
      text: `  ${question.correctValue.toUpperCase()} `,
    });

    expect(result.correct).toBe(true);
  });

  it('refuses to answer a submitted attempt', async () => {
    const { service, attempts } = build();
    await service.start(UNIT, USER_ID);
    const question = attempts.rows[0].questions[0];
    await service.submit(UNIT, 1, USER_ID);

    await expect(
      service.answer(UNIT, 1, question.exerciseId, USER_ID, { optionId: 'opt-0' }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('CheckpointService.submit', () => {
  it('passes at the pass mark and awards the full XP the first time', async () => {
    const { service, attempts, awardXp } = build({
      items: Array.from({ length: 10 }, (_, i) => kanaItem(i)),
    });
    await service.start(UNIT, USER_ID);
    await answerAll(service, attempts, 8); // 8/10 = 0.8

    const result = await service.submit(UNIT, 1, USER_ID);

    expect(result.score).toBe(CHECKPOINT_PASS_MARK);
    expect(result.passed).toBe(true);
    expect(result.xpAwarded).toBe(XP_PER_CHECKPOINT_PASS);
    expect(awardXp).toHaveBeenCalledWith(USER_ID, XP_PER_CHECKPOINT_PASS);
  });

  it('fails below the pass mark and awards nothing', async () => {
    const { service, attempts, awardXp } = build({
      items: Array.from({ length: 10 }, (_, i) => kanaItem(i)),
    });
    await service.start(UNIT, USER_ID);
    await answerAll(service, attempts, 7); // 7/10 = 0.7

    const result = await service.submit(UNIT, 1, USER_ID);

    expect(result.passed).toBe(false);
    expect(result.xpAwarded).toBe(0);
    expect(awardXp).not.toHaveBeenCalled();
  });

  it('awards the smaller repeat XP on a second pass of the same unit', async () => {
    const { service, attempts, awardXp } = build({
      items: Array.from({ length: 10 }, (_, i) => kanaItem(i)),
    });
    await service.start(UNIT, USER_ID);
    await answerAll(service, attempts, 10);
    await service.submit(UNIT, 1, USER_ID);

    await service.start(UNIT, USER_ID);
    const row = attempts.rows[1];
    for (const question of row.questions) {
      await service.answer(UNIT, row.attempt, question.exerciseId, USER_ID, {
        optionId: question.correctOptionId,
      });
    }
    const second = await service.submit(UNIT, row.attempt, USER_ID);

    expect(second.passed).toBe(true);
    expect(second.xpAwarded).toBe(XP_PER_CHECKPOINT_REPEAT);
    expect(awardXp).toHaveBeenLastCalledWith(USER_ID, XP_PER_CHECKPOINT_REPEAT);
  });

  it('awards XP exactly once however many times submit is called', async () => {
    const { service, attempts, awardXp } = build({
      items: Array.from({ length: 10 }, (_, i) => kanaItem(i)),
    });
    await service.start(UNIT, USER_ID);
    await answerAll(service, attempts, 10);

    await service.submit(UNIT, 1, USER_ID);
    const second = await service.submit(UNIT, 1, USER_ID);

    expect(awardXp).toHaveBeenCalledTimes(1);
    expect(second.xpAwarded).toBe(0);
    // The stored verdict still comes back, so a retried request is not an error.
    expect(second.passed).toBe(true);
  });

  it('counts unanswered questions as wrong', async () => {
    // Bailing at question three scores 3/20, not 3/3.
    const { service, attempts } = build({
      items: Array.from({ length: 10 }, (_, i) => kanaItem(i)),
    });
    await service.start(UNIT, USER_ID);
    const row = attempts.rows[0];
    await service.answer(UNIT, 1, row.questions[0].exerciseId, USER_ID, {
      optionId: row.questions[0].correctOptionId,
    });

    const result = await service.submit(UNIT, 1, USER_ID);

    expect(result.correctCount).toBe(1);
    expect(result.questionCount).toBe(10);
    expect(result.score).toBe(0.1);
    expect(result.missed.filter((m) => !m.answered)).toHaveLength(9);
  });

  it('pulls every missed item forward in the SRS, and nothing else', async () => {
    // The entire consequence of failing. `scheduleItemDue` writes `due` only —
    // a checkpoint answer is not a graded review and must not reach FSRS.
    const { service, attempts, scheduleItemDue } = build({
      items: Array.from({ length: 10 }, (_, i) => kanaItem(i)),
    });
    await service.start(UNIT, USER_ID);
    await answerAll(service, attempts, 6);

    const result = await service.submit(UNIT, 1, USER_ID);

    expect(scheduleItemDue).toHaveBeenCalledTimes(4);
    expect(result.scheduledForReview).toBe(4);
    for (const call of scheduleItemDue.mock.calls as unknown as [string, string, string][]) {
      expect(call[0]).toBe(USER_ID);
      expect(call[2]).toBe('kana');
    }
  });

  it('releases the answer key for missed items only', async () => {
    const { service, attempts } = build({
      items: Array.from({ length: 10 }, (_, i) => kanaItem(i)),
    });
    await service.start(UNIT, USER_ID);
    await answerAll(service, attempts, 6);

    const result = await service.submit(UNIT, 1, USER_ID);

    expect(result.missed).toHaveLength(4);
    for (const miss of result.missed) {
      expect(miss.correctValue).toMatch(/^romaji-/);
      expect(miss.prompt).toMatch(/^character-/);
    }
  });

  it('404s an attempt that does not exist', async () => {
    const { service } = build();

    await expect(service.submit(UNIT, 99, USER_ID)).rejects.toThrow(NotFoundException);
  });
});
