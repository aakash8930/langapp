import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { ContentService } from '../content.service';
import { LessonDetail } from '../dto/lesson-response.dto';
import { MultipleChoiceQuestion, Question } from '../dto/exercise-response.dto';
import { KanaItemDocument } from '../schemas/kana-item.schema';
import { VocabItemDocument } from '../schemas/vocab-item.schema';
import { ExerciseAttemptsService } from '../../learning/exercise-attempts.service';
import { LearningService } from '../../learning/learning.service';
import { ExerciseService } from './exercise.service';

/**
 * Narrow a question to `multipleChoice`. Tests in this file build lessons
 * with `exerciseTypes: ['multipleChoice']` and read questions back from the
 * generated set, so the only shape they ever see carries `options`. The new
 * `wordReading` lessons never reach these tests — those have their own
 * describe block below — but the union still requires a runtime check before
 * the type system will let the test touch `.options`.
 */
function asMultipleChoice(question: Question): MultipleChoiceQuestion {
  if (question.type !== 'multipleChoice') {
    throw new Error(`expected multipleChoice, got ${question.type}`);
  }
  return question as MultipleChoiceQuestion;
}

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

/** A vocabulary lesson and its unit pool, for the second answerable kind. */
const WORDS = [
  { id: 'v1', lemma: 'ねこ', gloss: 'cat' },
  { id: 'v2', lemma: 'いぬ', gloss: 'dog' },
  { id: 'v3', lemma: 'やま', gloss: 'mountain' },
];

const VOCAB_UNIT_POOL = [
  ...WORDS,
  { id: 'v4', lemma: 'うみ', gloss: 'sea' },
  { id: 'v5', lemma: 'そら', gloss: 'sky' },
  { id: 'v6', lemma: 'はな', gloss: 'flower' },
];

function vocabLesson(overrides: Partial<LessonDetail> = {}): LessonDetail {
  return lessonDetail({
    unit: 'vocab-basics',
    title: 'Words: nature',
    itemCount: WORDS.length,
    items: WORDS.map((w) => ({
      kind: 'vocab' as const,
      id: w.id,
      lemma: w.lemma,
      reading: w.lemma,
      gloss: w.gloss,
      pos: 'noun',
      jlpt: 'N5',
    })),
    ...overrides,
  });
}

function makeService(
  lesson: LessonDetail = lessonDetail(),
  pool = UNIT_POOL,
  vocabPool = VOCAB_UNIT_POOL,
): ExerciseService {
  return makeServiceWithAttempts(lesson, pool, vocabPool).service;
}

/**
 * Like `makeService`, but returns the `recordAttempt` mock too — for tests that
 * need to assert on what was persisted (T1.4: the completion gate's data
 * source). Default mock resolves to `true` so existing behaviour is preserved.
 */
function makeServiceWithAttempts(
  lesson: LessonDetail = lessonDetail(),
  pool = UNIT_POOL,
  vocabPool = VOCAB_UNIT_POOL,
  recordAttempt: jest.Mock = jest.fn(() => Promise.resolve(true)),
): { service: ExerciseService; recordAttempt: jest.Mock } {
  const contentService = {
    findLessonById: () => Promise.resolve(lesson),
    findUnitKanaPool: () =>
      Promise.resolve(
        pool.map((p) => ({ _id: p.id, kana: p.kana, romaji: p.romaji }) as unknown as KanaItemDocument),
      ),
    findUnitVocabPool: () =>
      Promise.resolve(
        vocabPool.map(
          (v) => ({ _id: v.id, lemma: v.lemma, gloss: v.gloss }) as unknown as VocabItemDocument,
        ),
      ),
  };
  const exerciseAttempts = { recordAttempt } as unknown as ExerciseAttemptsService;

  const service = new ExerciseService(
    contentService as unknown as ContentService,
    exerciseAttempts,
    fakeLearningService(),
  );
  return { service, recordAttempt };
}

/**
 * SRS scheduling is a fire-and-forget side effect of wrong answers. Tests in
 * this file care about grading and persistence; scheduling is asserted in its
 * own dedicated block below. Stubbed here so all existing tests keep passing.
 */
function fakeLearningService() {
  return {
    scheduleItemDue: jest.fn(() => Promise.resolve({ cardCreated: false, cardAdvanced: false })),
  } as unknown as LearningService;
}

describe('ExerciseService.generate', () => {
  it('builds one question per lesson item, each with 4 options', async () => {
    const set = await makeService().generate(LESSON_ID, USER_A, 0);

    expect(set.questionCount).toBe(5);
    expect(set.questions).toHaveLength(5);

    for (const question of set.questions) {
      // The kana lessons set `exerciseTypes: ['multipleChoice']`, so every
      // question here carries `options`. Narrow for the type system.
      if (question.type !== 'multipleChoice') continue;
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
      if (question.type !== 'multipleChoice') continue;
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
      if (question.type !== 'multipleChoice') continue;
      const expected = VOWELS.find((v) => v.kana === question.prompt)?.romaji;
      expect(question.options.map((o) => o.value)).toContain(expected);
    }
  });

  it('draws distractors from the unit, never invented strings, and never duplicates', async () => {
    const set = await makeService().generate(LESSON_ID, USER_A, 0);
    const realRomaji = new Set(UNIT_POOL.map((p) => p.romaji));

    for (const question of set.questions) {
      if (question.type !== 'multipleChoice') continue;
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

  it('refuses a lesson with no answerable items rather than returning an empty quiz', async () => {
    const service = makeService(lessonDetail({ items: [] }));

    await expect(service.generate(LESSON_ID, USER_A, 0)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('still refuses a lesson whose only items are a kind it cannot ask about', async () => {
    const service = makeService(
      lessonDetail({
        items: [
          // Grammar without examples: valid content, but nothing to quiz on.
          {
            kind: 'grammar',
            id: 'g1',
            title: 'は particle',
            jlpt: 'N5',
            explanation: '…',
            examples: [],
          },
        ],
      }),
    );

    await expect(service.generate(LESSON_ID, USER_A, 0)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('degrades to fewer options when the unit is too small for 3 distractors', async () => {
    const service = makeService(lessonDetail(), UNIT_POOL.slice(0, 3));

    const set = await service.generate(LESSON_ID, USER_A, 0);

    // 3 in the pool, minus the answer itself, leaves 2 distractors + 1 correct.
    for (const question of set.questions) {
      if (question.type !== 'multipleChoice') continue;
      expect(question.options.length).toBeLessThanOrEqual(4);
      expect(question.options.length).toBeGreaterThan(1);
    }
  });
});

describe('ExerciseService.answer', () => {
  it('marks the correct option correct and reports the answer', async () => {
    const service = makeService();
    const set = await service.generate(LESSON_ID, USER_A, 0);
    const question = asMultipleChoice(set.questions[0]);
    const expected = VOWELS.find((v) => v.kana === question.prompt)!.romaji;
    const correctOption = question.options.find((o) => o.value === expected)!;

    const result = await service.answer(LESSON_ID, question.exerciseId, USER_A, {
      optionId: correctOption.id,
    });

    expect(result.correct).toBe(true);
    expect(result.correctValue).toBe(expected);
    expect(result.selectedOptionId).toBe(correctOption.id);
    expect(result.prompt).toBe(question.prompt);
  });

  it('marks a wrong option incorrect but still returns the right answer', async () => {
    const service = makeService();
    const set = await service.generate(LESSON_ID, USER_A, 0);
    const question = asMultipleChoice(set.questions[0]);
    const expected = VOWELS.find((v) => v.kana === question.prompt)!.romaji;
    const wrongOption = question.options.find((o) => o.value !== expected)!;

    const result = await service.answer(LESSON_ID, question.exerciseId, USER_A, {
      optionId: wrongOption.id,
    });

    expect(result.correct).toBe(false);
    expect(result.selectedValue).toBe(wrongOption.value);
    expect(result.correctValue).toBe(expected);
  });

  it('grades every question in the set correctly', async () => {
    const service = makeService();
    const set = await service.generate(LESSON_ID, USER_A, 0);

    for (const raw of set.questions) {
      if (raw.type !== 'multipleChoice') continue;
      const question = raw;
      const expected = VOWELS.find((v) => v.kana === question.prompt)!.romaji;

      for (const option of question.options) {
        const result = await service.answer(LESSON_ID, question.exerciseId, USER_A, {
          optionId: option.id,
        });
        expect(result.correct).toBe(option.value === expected);
      }
    }
  });

  it('rejects an option id that is not part of the exercise', async () => {
    const service = makeService();
    const set = await service.generate(LESSON_ID, USER_A, 0);

    await expect(
      service.answer(LESSON_ID, set.questions[0].exerciseId, USER_A, { optionId: 'opt-99' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a malformed exercise id', async () => {
    const service = makeService();

    await expect(
      service.answer(LESSON_ID, 'not-an-id', USER_A, { optionId: 'opt-0' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an out-of-range question index', async () => {
    const service = makeService();

    await expect(
      service.answer(LESSON_ID, '0:99', USER_A, { optionId: 'opt-0' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("cannot be graded against another user's set", async () => {
    const service = makeService();
    const setForA = await service.generate(LESSON_ID, USER_A, 0);
    const question = asMultipleChoice(setForA.questions[0]);
    const expectedForA = VOWELS.find((v) => v.kana === question.prompt)!.romaji;
    const correctForA = question.options.find((o) => o.value === expectedForA)!;

    // Same exerciseId, different user: B's set is a different shuffle, so the
    // grading is against B's own question — not a leak of A's.
    const result = await service.answer(LESSON_ID, question.exerciseId, USER_B, {
      optionId: correctForA.id,
    });

    expect(result.prompt).toEqual(expect.any(String));
    expect(result.correctValue).toEqual(expect.any(String));
  });

  it('rejects sending text to a multipleChoice lesson', async () => {
    const service = makeService();
    const set = await service.generate(LESSON_ID, USER_A, 0);

    await expect(
      service.answer(LESSON_ID, set.questions[0].exerciseId, USER_A, { text: 'a' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('ExerciseService.answer — persists the attempt (T1.4)', () => {
  it('writes one row per answered exercise, with the right correctness flag', async () => {
    const { service, recordAttempt } = makeServiceWithAttempts();
    const set = await service.generate(LESSON_ID, USER_A, 0);
    const question = asMultipleChoice(set.questions[0]);
    const expected = VOWELS.find((v) => v.kana === question.prompt)!.romaji;
    const correctOption = question.options.find((o) => o.value === expected)!;

    await service.answer(LESSON_ID, question.exerciseId, USER_A, {
      optionId: correctOption.id,
    });

    expect(recordAttempt).toHaveBeenCalledTimes(1);
    expect(recordAttempt).toHaveBeenCalledWith(
      USER_A,
      LESSON_ID,
      0,
      question.exerciseId,
      true,
      undefined,
    );
  });

  it('persists correct=false when the learner picks the wrong option', async () => {
    const { service, recordAttempt } = makeServiceWithAttempts();
    const set = await service.generate(LESSON_ID, USER_A, 0);
    const question = asMultipleChoice(set.questions[0]);
    const expected = VOWELS.find((v) => v.kana === question.prompt)!.romaji;
    const wrongOption = question.options.find((o) => o.value !== expected)!;

    await service.answer(LESSON_ID, question.exerciseId, USER_A, {
      optionId: wrongOption.id,
    });

    expect(recordAttempt).toHaveBeenCalledWith(
      USER_A,
      LESSON_ID,
      0,
      question.exerciseId,
      false,
      undefined,
    );
  });

  it('does not gate the answer response on the persist succeeding', async () => {
    // Losing one attempt record is recoverable — denying the learner the answer
    // they just earned is not. The exception here is for non-duplicate-key
    // failures (the service swallows those internally); this simulates one
    // landing in the catch on `exercise.service.ts`.
    const recordAttempt = jest.fn(() => Promise.reject(new Error('mongo down')));
    const { service } = makeServiceWithAttempts(undefined, undefined, undefined, recordAttempt);
    const set = await service.generate(LESSON_ID, USER_A, 0);
    const question = asMultipleChoice(set.questions[0]);

    await expect(
      service.answer(LESSON_ID, question.exerciseId, USER_A, {
        optionId: question.options[0].id,
      }),
    ).resolves.toEqual(expect.objectContaining({ exerciseId: question.exerciseId }));
  });

  it('still writes the attempt for grammar lessons (cross-kind coverage)', async () => {
    const { service, recordAttempt } = grammarServiceWithAttempts();
    const set = await service.generate(LESSON_ID, USER_A, 0);
    const question = asMultipleChoice(set.questions[0]);
    const expected = POINTS.find((p) => p.sentence === question.prompt)!;
    const correctOption = question.options.find((o) => o.value === expected.answer)!;

    await service.answer(LESSON_ID, question.exerciseId, USER_A, {
      optionId: correctOption.id,
    });

    expect(recordAttempt).toHaveBeenCalledWith(
      USER_A,
      LESSON_ID,
      0,
      question.exerciseId,
      true,
      undefined,
    );
  });
});

/** A fingerprint of question order + option order, for comparing shuffles. */
function orderOf(
  set: { questions: { prompt: string; options?: { value: string }[] }[] },
): string {
  return set.questions
    .map((q) => `${q.prompt}:${(q.options ?? []).map((o) => o.value).join(',')}`)
    .join('|');
}

describe('ExerciseService.generate — vocabulary lessons', () => {
  it('asks what a word means, offering glosses', async () => {
    const set = await makeService(vocabLesson()).generate(LESSON_ID, USER_A, 0);

    expect(set.questionCount).toBe(WORDS.length);

    for (const raw of set.questions) {
      if (raw.type !== 'multipleChoice') continue;
      const question = raw;
      expect(question.promptKind).toBe('vocab');
      expect(question.question).toBe('What does this word mean?');
      // The prompt is the word; the options are meanings, never other words.
      expect(WORDS.concat(VOCAB_UNIT_POOL).map((w) => w.lemma)).toContain(question.prompt);
      for (const option of question.options) {
        expect(VOCAB_UNIT_POOL.map((w) => w.gloss)).toContain(option.value);
      }
    }
  });

  it('falls back to the unit pool when the lesson cannot supply enough distractors', async () => {
    // WORDS has 3 items; each question needs 3 distractors but the lesson only
    // provides 2 others (the remaining lesson items). So 1 must come from the
    // unit pool. This is the OPEN-ITEMS #29 fallback in action.
    const set = await makeService(vocabLesson()).generate(LESSON_ID, USER_A, 0);

    const offered = new Set(
      set.questions.flatMap((q) =>
        q.type === 'multipleChoice' ? q.options.map((o) => o.value) : [],
      ),
    );
    const beyondLesson = [...offered].filter(
      (gloss) => !WORDS.some((word) => word.gloss === gloss),
    );

    // At least one distractor must come from outside the lesson (unit fallback).
    expect(beyondLesson.length).toBeGreaterThan(0);
    // But every option is still a real vocab item from the unit.
    for (const gloss of offered) {
      expect(VOCAB_UNIT_POOL.map((w) => w.gloss)).toContain(gloss);
    }
  });

  it('marks the right gloss correct, and a wrong one incorrect', async () => {
    const service = makeService(vocabLesson());
    const set = await service.generate(LESSON_ID, USER_A, 0);
    const question = asMultipleChoice(set.questions[0]);
    const expected = WORDS.find((word) => word.lemma === question.prompt);

    // The answer key never leaves the service, so find the right option the
    // way a learner would have to: by knowing the word.
    const correctOption = question.options.find((o) => o.value === expected?.gloss);
    const wrongOption = question.options.find((o) => o.value !== expected?.gloss);

    const right = await service.answer(LESSON_ID, question.exerciseId, USER_A, {
      optionId: correctOption!.id,
    });
    expect(right.correct).toBe(true);
    expect(right.correctValue).toBe(expected?.gloss);

    const wrong = await service.answer(LESSON_ID, question.exerciseId, USER_A, {
      optionId: wrongOption!.id,
    });
    expect(wrong.correct).toBe(false);
    // Told what it should have been — the screen shows this after a miss.
    expect(wrong.correctValue).toBe(expected?.gloss);
  });

  it('is deterministic per (lesson, user, attempt), like the kana path', async () => {
    const first = await makeService(vocabLesson()).generate(LESSON_ID, USER_A, 0);
    const again = await makeService(vocabLesson()).generate(LESSON_ID, USER_A, 0);
    const other = await makeService(vocabLesson()).generate(LESSON_ID, USER_B, 0);

    expect(again.questions).toEqual(first.questions);
    expect(other.questions).not.toEqual(first.questions);
  });
});

/** A grammar lesson: gapped sentences, particles to choose between. */
const POINTS = [
  { id: 'g1', sentence: 'わたし＿せんせいです。', answer: 'は', gloss: 'I am a teacher.' },
  { id: 'g2', sentence: 'わたし＿ほんです。', answer: 'の', gloss: 'It is my book.' },
  { id: 'g3', sentence: 'ほん＿よみます。', answer: 'を', gloss: 'I read a book.' },
];

function grammarItem(p: (typeof POINTS)[number]) {
  return {
    kind: 'grammar' as const,
    id: p.id,
    title: `${p.answer} — particle`,
    jlpt: 'N5',
    explanation: '…',
    examples: [{ sentence: p.sentence, answer: p.answer, gloss: p.gloss }],
  };
}

function grammarService(items = POINTS.map(grammarItem)): ExerciseService {
  return grammarServiceWithAttempts(items).service;
}

function grammarServiceWithAttempts(items = POINTS.map(grammarItem)) {
  const contentService = {
    findLessonById: () =>
      Promise.resolve(
        lessonDetail({ unit: 'grammar-basics', title: 'Grammar', itemCount: items.length, items }),
      ),
    findUnitGrammarPool: () =>
      Promise.resolve(
        POINTS.map(
          (p) =>
            ({
              _id: p.id,
              examples: [{ sentence: p.sentence, answer: p.answer, gloss: p.gloss }],
            }) as unknown as never,
        ),
      ),
  };
  const recordAttempt = jest.fn(() => Promise.resolve(true));
  const exerciseAttempts = { recordAttempt } as unknown as ExerciseAttemptsService;

  const service = new ExerciseService(
    contentService as unknown as ContentService,
    exerciseAttempts,
    fakeLearningService(),
  );
  return { service, recordAttempt };
}

describe('ExerciseService.generate — grammar lessons', () => {
  it('asks which particle fills the gap, offering other particles', async () => {
    const set = await grammarService().generate(LESSON_ID, USER_A, 0);

    expect(set.questionCount).toBe(POINTS.length);

    for (const raw of set.questions) {
      if (raw.type !== 'multipleChoice') continue;
      const question = raw;
      expect(question.promptKind).toBe('grammar');
      // The prompt is the gapped sentence itself.
      expect(question.prompt).toContain('＿');
      for (const option of question.options) {
        expect(POINTS.map((p) => p.answer)).toContain(option.value);
      }
    }
  });

  it('puts the English gloss in the question, since the gap is otherwise ambiguous', async () => {
    const set = await grammarService().generate(LESSON_ID, USER_A, 0);

    for (const question of set.questions) {
      const expected = POINTS.find((p) => p.sentence === question.prompt);
      expect(question.question).toContain(expected!.gloss);
    }
  });

  it('never shows the answer in the prompt', async () => {
    const set = await grammarService().generate(LESSON_ID, USER_A, 0);

    for (const question of set.questions) {
      const expected = POINTS.find((p) => p.sentence === question.prompt);
      // The gap stands where the answer goes; it must not also appear beside it.
      expect(question.prompt.replace('＿', '')).not.toContain(expected!.answer);
    }
  });

  it('grades the gap correctly', async () => {
    const service = grammarService();
    const set = await service.generate(LESSON_ID, USER_A, 0);
    const question = asMultipleChoice(set.questions[0]);
    const expected = POINTS.find((p) => p.sentence === question.prompt)!;

    const correctOption = question.options.find((o) => o.value === expected.answer)!;
    const result = await service.answer(LESSON_ID, question.exerciseId, USER_A, {
      optionId: correctOption.id,
    });

    expect(result.correct).toBe(true);
    expect(result.correctValue).toBe(expected.answer);
  });

  it('skips a grammar point that has no example rather than asking an empty question', async () => {
    const withoutExample = { ...grammarItem(POINTS[0]), examples: [] };
    const set = await grammarService([grammarItem(POINTS[1]), withoutExample]).generate(
      LESSON_ID,
      USER_A,
      0,
    );

    expect(set.questionCount).toBe(1);
    expect(set.questions[0].prompt).toBe(POINTS[1].sentence);
  });
});

/**
 * The kanji unit (T1.7). Kanji → meaning, never kanji → reading: 山 is both やま
 * and サン, so a reading question would have two right answers.
 */
const KANJI = [
  { id: 'k1', char: '山', meanings: ['mountain'] },
  { id: 'k2', char: '海', meanings: ['sea'] },
  { id: 'k3', char: '空', meanings: ['sky', 'empty'] },
  { id: 'k4', char: '花', meanings: ['flower'] },
  { id: 'k5', char: '雨', meanings: ['rain'] },
];

function kanjiItem(k: (typeof KANJI)[number]) {
  return {
    kind: 'kanji' as const,
    id: k.id,
    char: k.char,
    on: ['サン'],
    kun: ['やま'],
    meanings: k.meanings,
    strokes: 3,
  };
}

function kanjiService(items = KANJI.map(kanjiItem)): ExerciseService {
  const contentService = {
    findLessonById: () =>
      Promise.resolve(
        lessonDetail({ unit: 'kanji-basics', title: 'Kanji', itemCount: items.length, items }),
      ),
    findUnitKanjiPool: () =>
      Promise.resolve(
        KANJI.map((k) => ({ _id: k.id, char: k.char, meanings: k.meanings }) as unknown as never),
      ),
  };
  const exerciseAttempts = {
    recordAttempt: jest.fn(() => Promise.resolve(true)),
  } as unknown as ExerciseAttemptsService;

  return new ExerciseService(
    contentService as unknown as ContentService,
    exerciseAttempts,
    fakeLearningService(),
  );
}

describe('ExerciseService.generate — kanji lessons (T1.7)', () => {
  it('asks what the kanji means, offering meanings of other kanji in the unit', async () => {
    const set = await kanjiService().generate(LESSON_ID, USER_A, 0);

    expect(set.questionCount).toBe(KANJI.length);

    const allMeanings = KANJI.map((k) => k.meanings.join(', '));
    for (const raw of set.questions) {
      const question = asMultipleChoice(raw);
      expect(question.promptKind).toBe('kanji');
      expect(question.question).toBe('What does this kanji mean?');
      // The prompt is a single glyph — that is what promptKind 'kanji' promises.
      expect([...question.prompt]).toHaveLength(1);
      for (const option of question.options) {
        expect(allMeanings).toContain(option.value);
      }
    }
  });

  it('never puts a reading in the options, because a reading question has two answers', async () => {
    const set = await kanjiService().generate(LESSON_ID, USER_A, 0);

    for (const raw of set.questions) {
      for (const option of asMultipleChoice(raw).options) {
        // No kana anywhere in an option: the answer is English meaning only.
        expect(option.value).not.toMatch(/[ぁ-んァ-ヴ]/);
      }
    }
  });

  it('joins multiple meanings into one option rather than offering them separately', async () => {
    const set = await kanjiService().generate(LESSON_ID, USER_A, 0);
    const sky = set.questions.find((q) => q.prompt === '空');

    const option = asMultipleChoice(sky!).options.find((o) => o.value === 'sky, empty');
    expect(option).toBeDefined();
  });

  it('grades the meaning correctly', async () => {
    const service = kanjiService();
    const set = await service.generate(LESSON_ID, USER_A, 0);
    const question = asMultipleChoice(set.questions[0]);
    const expected = KANJI.find((k) => k.char === question.prompt)!;

    const correct = question.options.find((o) => o.value === expected.meanings.join(', '))!;
    const result = await service.answer(LESSON_ID, question.exerciseId, USER_A, {
      optionId: correct.id,
    });

    expect(result.correct).toBe(true);
    expect(result.correctValue).toBe(expected.meanings.join(', '));
  });

  it('skips a kanji with no meanings rather than offering a blank option', async () => {
    const meaningless = { ...kanjiItem(KANJI[0]), meanings: [] };
    const set = await kanjiService([kanjiItem(KANJI[1]), meaningless]).generate(
      LESSON_ID,
      USER_A,
      0,
    );

    expect(set.questionCount).toBe(1);
    expect(set.questions[0].prompt).toBe('海');
  });
});

/**
 * The marks-words unit is the only place wordReading lives today. Each item
 * is a vocabulary with a romaji; the prompt is the lemma, the answer is the
 * romaji the learner types.
 *
 * The new exercise type only matters for っ and ー — a typo of "gakou"
 * instead of "gakkou" is *the* mistake the lesson teaches, so the grader
 * does exact comparison rather than apologetic fuzzy matching.
 */
const READING_WORDS = [
  { id: 'w1', lemma: 'がっこう', romans: 'gakkou' },
  { id: 'w2', lemma: 'コーヒー', romans: 'koohii' },
  { id: 'w3', lemma: 'ベッド', romans: 'beddo' },
];

function wordReadingLesson(overrides: Partial<LessonDetail> = {}): LessonDetail {
  return lessonDetail({
    unit: 'hiragana-marks-extra',
    title: 'Hiragana words: っ and ー',
    exerciseTypes: ['wordReading'],
    itemCount: READING_WORDS.length,
    items: READING_WORDS.map((w) => ({
      kind: 'vocab' as const,
      id: w.id,
      lemma: w.lemma,
      reading: w.lemma,
      gloss: 'placeholder',
      pos: 'noun',
      jlpt: 'N5',
      romaji: w.romans,
    })),
    ...overrides,
  });
}

function wordReadingService(): ExerciseService {
  return makeService(wordReadingLesson());
}

describe('ExerciseService.generate — wordReading lessons (T1.1)', () => {
  it('builds one question per item, with no `options` array', async () => {
    const set = await wordReadingService().generate(LESSON_ID, USER_A, 0);

    expect(set.questionCount).toBe(READING_WORDS.length);

    for (const question of set.questions) {
      expect(question.type).toBe('wordReading');
      expect(question.promptKind).toBe('wordReading');
      // The whole point: no options to pick. The learner types.
      expect(question).not.toHaveProperty('options');
    }
  });

  it('shows the lemma as the prompt and asks for the romaji', async () => {
    const set = await wordReadingService().generate(LESSON_ID, USER_A, 0);

    for (const question of set.questions) {
      expect(READING_WORDS.map((w) => w.lemma)).toContain(question.prompt);
      expect(question.question).toBe('How do you read this word?');
    }
  });

  it('never leaks the answer key in the payload', async () => {
    const set = await wordReadingService().generate(LESSON_ID, USER_A, 0);
    const serialized = JSON.stringify(set);

    // No `correctOptionId`, no `correctValue`, no `correct` flag — same
    // allowlist as multipleChoice, applied to the new shape.
    expect(serialized).not.toContain('correctOptionId');
    expect(serialized).not.toContain('correctValue');
    expect(serialized).not.toContain('correct');
  });

  it('is deterministic per (lesson, user, attempt)', async () => {
    const first = await wordReadingService().generate(LESSON_ID, USER_A, 0);
    const again = await wordReadingService().generate(LESSON_ID, USER_A, 0);

    expect(again.questions).toEqual(first.questions);
  });

  it('rejects a lesson that has no vocabulary items', async () => {
    const kanaOnly = lessonDetail({
      exerciseTypes: ['wordReading'],
      items: [{ kind: 'kana', id: 'k1', kana: 'あ', romaji: 'a', script: 'hiragana', row: 'a', order: 0 }],
    });
    const service = makeService(kanaOnly);

    await expect(service.generate(LESSON_ID, USER_A, 0)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });
});

describe('ExerciseService.answer — wordReading lessons (T1.1)', () => {
  it('accepts the canonical romaji, with no options to choose from', async () => {
    const service = wordReadingService();
    const set = await service.generate(LESSON_ID, USER_A, 0);
    const question = set.questions[0];
    const expected = READING_WORDS.find((w) => w.lemma === question.prompt)!.romans;

    const result = await service.answer(LESSON_ID, question.exerciseId, USER_A, {
      text: expected,
    });

    expect(result.correct).toBe(true);
    expect(result.correctValue).toBe(expected);
    expect(result.prompt).toBe(question.prompt);
  });

  it('rejects a wrong answer (missed doubling, vowel swap) without being apologetic', async () => {
    // The whole point of the lesson is the doubled consonant in がっこう.
    // Writing `gakou` is the mistake that proves the rule is missing. A
    // forgiving match would teach the wrong thing.
    const service = wordReadingService();
    const set = await service.generate(LESSON_ID, USER_A, 0);
    const question = set.questions[0];
    const expected = READING_WORDS.find((w) => w.lemma === question.prompt)!.romans;
    const wrong = expected.slice(0, 1) + expected.slice(3);

    const result = await service.answer(LESSON_ID, question.exerciseId, USER_A, {
      text: wrong,
    });

    expect(result.correct).toBe(false);
    expect(result.correctValue).toBe(expected);
    expect(result.selectedValue).toBe(wrong);
  });

  it('normalises case: GAKKOU is the same as gakkou', async () => {
    const service = wordReadingService();
    const set = await service.generate(LESSON_ID, USER_A, 0);
    const question = set.questions[0];
    const expected = READING_WORDS.find((w) => w.lemma === question.prompt)!.romans;

    const result = await service.answer(LESSON_ID, question.exerciseId, USER_A, {
      text: expected.toUpperCase(),
    });

    expect(result.correct).toBe(true);
  });

  it('normalises whitespace: leading/trailing/inner spaces are collapsed', async () => {
    const service = wordReadingService();
    const set = await service.generate(LESSON_ID, USER_A, 0);
    const question = set.questions[0];
    const expected = READING_WORDS.find((w) => w.lemma === question.prompt)!.romans;

    const padded = `  ${expected.slice(0, 2)} ${expected.slice(2)}  `;

    const result = await service.answer(LESSON_ID, question.exerciseId, USER_A, {
      text: padded,
    });

    expect(result.correct).toBe(true);
  });

  it('rejects sending optionId to a wordReading lesson', async () => {
    const service = wordReadingService();
    const set = await service.generate(LESSON_ID, USER_A, 0);

    await expect(
      service.answer(LESSON_ID, set.questions[0].exerciseId, USER_A, { optionId: 'opt-0' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('persists the typed attempt, so the lesson gate (T1.4) sees it', async () => {
    const { service, recordAttempt } = makeServiceWithAttempts(wordReadingLesson());
    const set = await service.generate(LESSON_ID, USER_A, 0);
    const question = set.questions[0];
    const expected = READING_WORDS.find((w) => w.lemma === question.prompt)!.romans;

    const result = await service.answer(LESSON_ID, question.exerciseId, USER_A, {
      text: expected,
    });

    expect(result.correct).toBe(true);
    expect(recordAttempt).toHaveBeenCalledWith(
      USER_A,
      LESSON_ID,
      0,
      question.exerciseId,
      true,
      undefined,
    );
  });

  it('rejects a malformed exercise id on a wordReading lesson', async () => {
    const service = wordReadingService();

    await expect(
      service.answer(LESSON_ID, 'not-an-id', USER_A, { text: 'gakkou' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

// The "answer — hearts (slice 2)" describe block that lived here was removed
// when hearts/gems were deleted in Phase 2 Stage 0 (§3.1). Wrong-answer
// behaviour is covered by the answer describe blocks above; the SRS pull-forward
// has its own describe block below.

/**
 * `itemId` — which content item a question is about.
 *
 * The client needs it to play a word's audio in the quiz (`GET
 * /content/vocab/:id/audio` is keyed by the vocabulary item's own id), but the
 * field is deliberately generic: every prompt kind carries it, and what a
 * surface does with it is the surface's decision.
 *
 * The tests that matter are the ones that would catch it being wired to the
 * wrong thing — a distractor's id, or an index into the shuffle.
 */
describe('ExerciseService.generate — itemId', () => {
  it('carries the id of the kana item the prompt came from', async () => {
    const set = await makeService().generate(LESSON_ID, USER_A, 0);

    for (const question of set.questions) {
      const source = VOWELS.find((v) => v.kana === question.prompt);
      expect(question.itemId).toBe(source!.id);
    }
  });

  it('carries the vocabulary item id, which is what the audio route is keyed by', async () => {
    const set = await makeService(vocabLesson()).generate(LESSON_ID, USER_A, 0);

    for (const question of set.questions) {
      const source = WORDS.find((w) => w.lemma === question.prompt);
      expect(question.itemId).toBe(source!.id);
    }
  });

  it('carries the item id on wordReading questions too, which have no options', async () => {
    const set = await wordReadingService().generate(LESSON_ID, USER_A, 0);

    for (const question of set.questions) {
      expect(question.type).toBe('wordReading');
      const source = READING_WORDS.find((w) => w.lemma === question.prompt);
      expect(question.itemId).toBe(source!.id);
    }
  });

  it('carries the kanji entry id', async () => {
    const set = await kanjiService().generate(LESSON_ID, USER_A, 0);

    for (const question of set.questions) {
      const source = KANJI.find((k) => k.char === question.prompt);
      expect(question.itemId).toBe(source!.id);
    }
  });

  /**
   * Grammar resolves to the *point*, not the example sentence — a point
   * contributes at most one question (its first example), so the mapping stays
   * one-to-one even though the prompt is a sentence.
   */
  it('carries the grammar point id, not an example id', async () => {
    const set = await grammarService().generate(LESSON_ID, USER_A, 0);

    for (const question of set.questions) {
      const source = POINTS.find((p) => p.sentence === question.prompt);
      expect(question.itemId).toBe(source!.id);
    }
  });

  /**
   * The failure this guards against: wiring `itemId` off a distractor rather
   * than the asked item. The vocabulary unit pool is twice the lesson, so a
   * distractor-sourced id would show up here as an id the lesson never taught.
   */
  it('is always the asked item, never one of the distractors', async () => {
    const set = await makeService(vocabLesson()).generate(LESSON_ID, USER_A, 0);

    const lessonIds = WORDS.map((w) => w.id);
    const distractorOnlyIds = VOCAB_UNIT_POOL.map((v) => v.id).filter(
      (id) => !lessonIds.includes(id),
    );
    expect(distractorOnlyIds.length).toBeGreaterThan(0);

    for (const question of set.questions) {
      expect(lessonIds).toContain(question.itemId);
      expect(distractorOnlyIds).not.toContain(question.itemId);
    }
  });

  /**
   * `exerciseId` is a position in a shuffle and changes between attempts;
   * `itemId` is the thing being asked about and must not. This is what makes it
   * usable as a stable key for per-item client state.
   */
  it('survives a reshuffle, unlike exerciseId', async () => {
    // The kana lesson, not the vocabulary one: five items shuffle 120 ways,
    // where three shuffle only six — and attempts 0 and 1 of *those* land on the
    // same order, which would make the premise check below pass vacuously. The
    // same pair is already asserted to differ by "differs by attempt" above.
    const first = await makeService().generate(LESSON_ID, USER_A, 0);
    const second = await makeService().generate(LESSON_ID, USER_A, 1);

    // The premise: these really are two different shuffles, so the per-item
    // comparison is not quietly comparing a set with itself.
    expect(orderOf(second)).not.toEqual(orderOf(first));

    const idFor = (set: { questions: { prompt: string; itemId: string }[] }, prompt: string) =>
      set.questions.find((q) => q.prompt === prompt)!.itemId;

    for (const vowel of VOWELS) {
      expect(idFor(first, vowel.kana)).toBe(idFor(second, vowel.kana));
      // And the position genuinely moved for at least the set as a whole, which
      // is the contrast being drawn: exerciseId is positional, itemId is not.
      expect(idFor(first, vowel.kana)).toBe(vowel.id);
    }
  });

  /**
   * The id resolves to public lesson content, which already carries glosses and
   * romaji — so this asserts what `itemId` must *not* have changed: the answer
   * key still never rides along with it.
   */
  it('does not bring the answer key with it', async () => {
    const set = await makeService(vocabLesson()).generate(LESSON_ID, USER_A, 0);
    const serialized = JSON.stringify(set);

    expect(serialized).not.toContain('correctOptionId');
    expect(serialized).not.toContain('correctValue');

    for (const raw of set.questions) {
      const question = asMultipleChoice(raw);
      expect(Object.keys(question).sort()).toEqual(
        ['exerciseId', 'itemId', 'options', 'prompt', 'promptKind', 'question', 'type'].sort(),
      );
    }
  });
});
