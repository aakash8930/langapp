import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { ContentService } from '../content.service';
import { LessonDetail } from '../dto/lesson-response.dto';
import { KanaItemDocument } from '../schemas/kana-item.schema';
import { ExerciseService } from './exercise.service';

const UNIT = 'hiragana-basics';
const LESSON_ID = '507f1f77bcf86cd799439011';
const USER_A = '607f1f77bcf86cd799439011';
const USER_B = '707f1f77bcf86cd799439011';

/** The five vowels — what lesson 1 teaches. */
const VOWELS = [
  { id: 'k1', kana: 'あ', romaji: 'a' },
  { id: 'k2', kana: 'い', romaji: 'i' },
  { id: 'k3', kana: 'う', romaji: 'u' },
  { id: 'k4', kana: 'え', romaji: 'e' },
  { id: 'k5', kana: 'お', romaji: 'o' },
];

/** The whole unit — 25 characters, the distractor pool. */
const UNIT_POOL = [
  ...VOWELS,
  { id: 'k6', kana: 'か', romaji: 'ka' },
  { id: 'k7', kana: 'き', romaji: 'ki' },
  { id: 'k8', kana: 'く', romaji: 'ku' },
  { id: 'k9', kana: 'け', romaji: 'ke' },
  { id: 'k10', kana: 'こ', romaji: 'ko' },
  { id: 'k11', kana: 'さ', romaji: 'sa' },
  { id: 'k12', kana: 'し', romaji: 'shi' },
  { id: 'k13', kana: 'た', romaji: 'ta' },
  { id: 'k14', kana: 'な', romaji: 'na' },
];

function lessonDetail(overrides: Partial<LessonDetail> = {}): LessonDetail {
  return {
    id: LESSON_ID,
    lang: 'ja',
    unit: UNIT,
    order: 0,
    title: 'Hiragana: the five vowels (あ row)',
    exerciseTypes: ['multipleChoice'],
    itemCount: VOWELS.length,
    prerequisiteLessonIds: [],
    items: VOWELS.map((v) => ({
      kind: 'kana' as const,
      id: v.id,
      kana: v.kana,
      romaji: v.romaji,
      script: 'hiragana',
      row: 'a',
      order: 0,
    })),
    ...overrides,
  };
}

function makeService(lesson: LessonDetail = lessonDetail(), pool = UNIT_POOL): ExerciseService {
  const contentService = {
    findLessonById: () => Promise.resolve(lesson),
    findUnitKanaPool: () =>
      Promise.resolve(
        pool.map((p) => ({ _id: p.id, kana: p.kana, romaji: p.romaji }) as unknown as KanaItemDocument),
      ),
  };

  return new ExerciseService(contentService as unknown as ContentService);
}

describe('ExerciseService.generate', () => {
  it('builds one question per lesson item, each with 4 options', async () => {
    const set = await makeService().generate(LESSON_ID, USER_A, 0);

    expect(set.questionCount).toBe(5);
    expect(set.questions).toHaveLength(5);

    for (const question of set.questions) {
      expect(question.options).toHaveLength(4);
      expect(question.type).toBe('multipleChoice');
      expect(question.promptKind).toBe('kana');
    }
  });

  it('asks about every item in the lesson exactly once', async () => {
    const set = await makeService().generate(LESSON_ID, USER_A, 0);

    expect(set.questions.map((q) => q.prompt).sort()).toEqual(
      VOWELS.map((v) => v.kana).sort(),
    );
  });

  it('never leaks the answer in the payload', async () => {
    const set = await makeService().generate(LESSON_ID, USER_A, 0);
    const serialized = JSON.stringify(set);

    expect(serialized).not.toContain('correctOptionId');
    expect(serialized).not.toContain('correctValue');
    expect(serialized).not.toContain('correct');

    for (const question of set.questions) {
      expect(question).not.toHaveProperty('correctOptionId');
      expect(question).not.toHaveProperty('correctValue');
      // Options carry only an id and a value — nothing marking which is right.
      for (const option of question.options) {
        expect(Object.keys(option).sort()).toEqual(['id', 'value']);
      }
    }
  });

  it('includes the correct romaji among the options for every question', async () => {
    const set = await makeService().generate(LESSON_ID, USER_A, 0);

    for (const question of set.questions) {
      const expected = VOWELS.find((v) => v.kana === question.prompt)?.romaji;
      expect(question.options.map((o) => o.value)).toContain(expected);
    }
  });

  it('draws distractors from the unit, never invented strings, and never duplicates', async () => {
    const set = await makeService().generate(LESSON_ID, USER_A, 0);
    const realRomaji = new Set(UNIT_POOL.map((p) => p.romaji));

    for (const question of set.questions) {
      const values = question.options.map((o) => o.value);

      // Every option is a real character's reading from this unit.
      for (const value of values) {
        expect(realRomaji.has(value)).toBe(true);
      }
      // No option appears twice — an unanswerable question otherwise.
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it('is deterministic: the same (lesson, user, attempt) regenerates identically', async () => {
    const first = await makeService().generate(LESSON_ID, USER_A, 0);
    const second = await makeService().generate(LESSON_ID, USER_A, 0);

    // A refresh mid-session must not reshuffle anything.
    expect(second).toEqual(first);
  });

  it('differs by attempt, so a retry is a fresh shuffle', async () => {
    const first = await makeService().generate(LESSON_ID, USER_A, 0);
    const second = await makeService().generate(LESSON_ID, USER_A, 1);

    expect(orderOf(second)).not.toEqual(orderOf(first));
  });

  it('differs by user, so two learners do not get an identical quiz', async () => {
    const forA = await makeService().generate(LESSON_ID, USER_A, 0);
    const forB = await makeService().generate(LESSON_ID, USER_B, 0);

    expect(orderOf(forB)).not.toEqual(orderOf(forA));
  });

  it('refuses a lesson that does not offer multipleChoice', async () => {
    const service = makeService(lessonDetail({ exerciseTypes: ['listenType'] }));

    await expect(service.generate(LESSON_ID, USER_A, 0)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('refuses a lesson with no kana items rather than returning an empty quiz', async () => {
    const service = makeService(lessonDetail({ items: [] }));

    await expect(service.generate(LESSON_ID, USER_A, 0)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('degrades to fewer options when the unit is too small for 3 distractors', async () => {
    const service = makeService(lessonDetail(), UNIT_POOL.slice(0, 3));

    const set = await service.generate(LESSON_ID, USER_A, 0);

    // 3 in the pool, minus the answer itself, leaves 2 distractors + 1 correct.
    for (const question of set.questions) {
      expect(question.options.length).toBeLessThanOrEqual(4);
      expect(question.options.length).toBeGreaterThan(1);
    }
  });
});

describe('ExerciseService.answer', () => {
  it('marks the correct option correct and reports the answer', async () => {
    const service = makeService();
    const set = await service.generate(LESSON_ID, USER_A, 0);
    const question = set.questions[0];
    const expected = VOWELS.find((v) => v.kana === question.prompt)!.romaji;
    const correctOption = question.options.find((o) => o.value === expected)!;

    const result = await service.answer(LESSON_ID, question.exerciseId, USER_A, correctOption.id);

    expect(result.correct).toBe(true);
    expect(result.correctValue).toBe(expected);
    expect(result.selectedOptionId).toBe(correctOption.id);
    expect(result.prompt).toBe(question.prompt);
  });

  it('marks a wrong option incorrect but still returns the right answer', async () => {
    const service = makeService();
    const set = await service.generate(LESSON_ID, USER_A, 0);
    const question = set.questions[0];
    const expected = VOWELS.find((v) => v.kana === question.prompt)!.romaji;
    const wrongOption = question.options.find((o) => o.value !== expected)!;

    const result = await service.answer(LESSON_ID, question.exerciseId, USER_A, wrongOption.id);

    expect(result.correct).toBe(false);
    expect(result.selectedValue).toBe(wrongOption.value);
    expect(result.correctValue).toBe(expected);
  });

  it('grades every question in the set correctly', async () => {
    const service = makeService();
    const set = await service.generate(LESSON_ID, USER_A, 0);

    for (const question of set.questions) {
      const expected = VOWELS.find((v) => v.kana === question.prompt)!.romaji;

      for (const option of question.options) {
        const result = await service.answer(LESSON_ID, question.exerciseId, USER_A, option.id);
        expect(result.correct).toBe(option.value === expected);
      }
    }
  });

  it('rejects an option id that is not part of the exercise', async () => {
    const service = makeService();
    const set = await service.generate(LESSON_ID, USER_A, 0);

    await expect(
      service.answer(LESSON_ID, set.questions[0].exerciseId, USER_A, 'opt-99'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a malformed exercise id', async () => {
    const service = makeService();

    await expect(service.answer(LESSON_ID, 'not-an-id', USER_A, 'opt-0')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects an out-of-range question index', async () => {
    const service = makeService();

    await expect(service.answer(LESSON_ID, '0:99', USER_A, 'opt-0')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("cannot be graded against another user's set", async () => {
    const service = makeService();
    const setForA = await service.generate(LESSON_ID, USER_A, 0);
    const question = setForA.questions[0];
    const expectedForA = VOWELS.find((v) => v.kana === question.prompt)!.romaji;
    const correctForA = question.options.find((o) => o.value === expectedForA)!;

    // Same exerciseId, different user: B's set is a different shuffle, so the
    // grading is against B's own question — not a leak of A's.
    const result = await service.answer(LESSON_ID, question.exerciseId, USER_B, correctForA.id);

    expect(result.prompt).toEqual(expect.any(String));
    expect(result.correctValue).toEqual(expect.any(String));
  });
});

/** A fingerprint of question order + option order, for comparing shuffles. */
function orderOf(set: { questions: { prompt: string; options: { value: string }[] }[] }): string {
  return set.questions.map((q) => `${q.prompt}:${q.options.map((o) => o.value).join(',')}`).join('|');
}
