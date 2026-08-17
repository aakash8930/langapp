import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
  forwardRef,
} from '@nestjs/common';
import { Types } from 'mongoose';
import {
  CheckpointAttemptsService,
  CHECKPOINT_PASS_MARK,
} from '../../learning/checkpoint-attempts.service';
import { LearnerItemStateService } from '../../learning/learner-item-state.service';
import { LearningService } from '../../learning/learning.service';
import { CheckpointQuestion } from '../../learning/schemas/unit-checkpoint-attempt.schema';
import { UserService } from '../../user/user.service';
import { ContentService, UnitContent } from '../content.service';
import { AnswerResult } from '../dto/exercise-response.dto';
import { CheckpointResult, CheckpointSet, toPublicCheckpointQuestion } from '../dto/checkpoint-response.dto';
import { mulberry32, seedFrom, shuffle } from '../exercise/deterministic-random';
import {
  assembleOptions,
  Choice,
  GRAMMAR_QUESTION,
  isGrammar,
  isKana,
  isKanji,
  isVocab,
  KANA_QUESTION,
  KANJI_QUESTION,
  kanaChoice,
  KindQuestion,
  normaliseAnswer,
  promptKindToContentKind,
  toGrammarChoice,
  toKanjiChoice,
  VOCAB_QUESTION,
  vocabChoice,
  WORD_READING_QUESTION,
} from '../exercise/question-builder';

/** Maximum questions in a combined test. */
export const COMBINED_QUESTION_COUNT = 40;

/** Awarded the first time a learner passes a combined test. */
export const XP_PER_COMBINED_PASS = 100;

/** Awarded for passing a combined test already passed. */
export const XP_PER_COMBINED_REPEAT = 10;

/** A combined test needs at least this many finished units to be worth offering. */
export const COMBINED_MIN_FINISHED_UNITS = 2;

/**
 * The end-of-course combined test.
 *
 * ## Why this is a sibling of `CheckpointService` rather than a flag on it
 *
 * The two tests look the same on screen (same DTO, same one-shot answer rule,
 * same missed-at-submit summary) but their *generation* is genuinely different:
 *
 *  - a checkpoint draws from one unit's items, with the unit pool as the
 *    distractor source;
 *  - a combined test draws from the union of every finished unit's items, with
 *    that union as the distractor source, and its `unit` field is a hash of
 *    the slug list rather than a slug.
 *
 * Folding them into one service means a `if (combined) { … }` branch at every
 * decision point (which pool? which distractor source? which XP table? which
 * `sourceContext` for the learner model?). Two services with the same shape
 * is the boring version.
 *
 * ## What "finished" means
 *
 * The same rule the client uses: every lesson in the unit is in
 * `lessonCompletions`. Computed server-side from `LearningService` because
 * the client must not be able to ask for a test of units it has not done —
 * that would be a free XP tap.
 */
@Injectable()
export class CombinedTestService {
  private readonly logger = new Logger(CombinedTestService.name);

  constructor(
    private readonly contentService: ContentService,
    @Inject(forwardRef(() => CheckpointAttemptsService))
    private readonly attempts: CheckpointAttemptsService,
    @Inject(forwardRef(() => LearnerItemStateService))
    private readonly learnerItemState: LearnerItemStateService,
    @Inject(forwardRef(() => LearningService))
    private readonly learningService: LearningService,
    private readonly userService: UserService,
  ) {}

  /**
   * Start a combined test, or resume the one already open.
   *
   * Same resume-not-regenerate rule as `CheckpointService.start`: a learner
   * who doesn't like their draw cannot abandon and re-roll, and a refresh
   * mid-test lands on the same questions. The marker is deterministic in
   * the slug list, so a learner who finishes no new unit between calls gets
   * the same attempt back.
   *
   * Throws 422 if the learner has fewer than `COMBINED_MIN_FINISHED_UNITS`
   * finished units — a one-unit "combined" test is the per-unit test by
   * another name, and the UI gates the entry card on the same number, so
   * this is the last line of defence.
   */
  async start(userId: string): Promise<CombinedTestSet> {
    const unitSlugs = await this.learningService.listFinishedUnitSlugs(userId);
    if (unitSlugs.length < COMBINED_MIN_FINISHED_UNITS) {
      throw new UnprocessableEntityException(
        `Need at least ${COMBINED_MIN_FINISHED_UNITS} finished units to take a combined test ` +
          `(have ${unitSlugs.length})`,
      );
    }

    const marker = this.attempts.combinedUnitMarker(unitSlugs);

    const open = await this.attempts.findOpen(userId, marker);
    if (open) {
      return this.toSet(open);
    }

    const pool = await this.aggregateFinishedUnitContent(unitSlugs);
    if (pool.items.length === 0) {
      throw new UnprocessableEntityException(
        'No testable items across the finished units',
      );
    }

    const exerciseType = pickExerciseType(pool);
    const questions = await this.buildQuestions(
      pool,
      unitSlugs,
      userId,
      exerciseType,
    );
    if (questions.length === 0) {
      throw new UnprocessableEntityException(
        'No questions could be generated for the finished units',
      );
    }

    const created = await this.attempts.create(userId, marker, questions, {
      kind: 'combined',
      unitSlugs,
    });

    return this.toSet(created);
  }

  async answer(
    attemptNumber: number,
    exerciseId: string,
    userId: string,
    body: { optionId?: string; text?: string; responseTimeMs?: number },
  ): Promise<AnswerResult> {
    const attempt = await this.findAttempt(userId, attemptNumber);
    if (!attempt) {
      throw new NotFoundException(`No combined-test attempt ${attemptNumber}`);
    }
    if (attempt.submittedAt !== null) {
      throw new BadRequestException('This combined test has already been submitted.');
    }

    const question = attempt.questions.find((q) => q.exerciseId === exerciseId);
    if (!question) {
      throw new BadRequestException(`Unknown exercise: ${exerciseId}`);
    }

    const graded = this.grade(question, body);

    const stored = await this.attempts.recordAnswer(
      attempt._id,
      exerciseId,
      graded.correct,
      body.responseTimeMs,
    );
    const correct = stored ? graded.correct : question.correct;

    if (stored) {
      this.recordEvidence(userId, question, correct, body.responseTimeMs);
    }

    return {
      exerciseId,
      correct,
      selectedOptionId: graded.selectedOptionId,
      selectedValue: graded.selectedValue,
      // A combined test, like a checkpoint, withholds per-question verdicts
      // until submit — the answer key arrives in `missed` then.
      correctOptionId: '',
      correctValue: '',
      prompt: question.prompt,
    };
  }

  async submit(attemptNumber: number, userId: string): Promise<CombinedTestResult> {
    const attempt = await this.findAttempt(userId, attemptNumber);
    if (!attempt) {
      throw new NotFoundException(`No combined-test attempt ${attemptNumber}`);
    }

    const total = attempt.questions.length;
    const correctCount = attempt.questions.filter((q) => q.correct).length;
    const score = total > 0 ? round2(correctCount / total) : 0;
    const passed = score >= CHECKPOINT_PASS_MARK;

    // Read "has the learner ever passed a combined test" *before* closing
    // this attempt — otherwise this very attempt would count as the first.
    const passedBefore = await this.attempts.hasPassedCombined(userId);

    const closed = await this.attempts.submit(attempt._id, score, passed);
    if (!closed) {
      return this.toResult(
        attempt.attempt,
        attempt.unitSlugs,
        attempt.questions,
        attempt.score ?? score,
        attempt.passed ?? passed,
        0,
      );
    }

    let xpAwarded = 0;
    if (passed) {
      xpAwarded = passedBefore ? XP_PER_COMBINED_REPEAT : XP_PER_COMBINED_PASS;
      await this.userService.awardXp(userId, xpAwarded);
    }

    return this.toResult(attempt.attempt, attempt.unitSlugs, attempt.questions, score, passed, xpAwarded);
  }

  private async findAttempt(
    userId: string,
    attemptNumber: number,
  ): Promise<Awaited<ReturnType<CheckpointAttemptsService['findAttempt']>> | null> {
    // The marker depends on the slug set, which we only know by re-deriving
    // it. `findAttempt` keys on (userId, unit, attempt), so we need the
    // marker to read the row. Re-derive it from the current finished set —
    // it is deterministic, so this lands on the same marker as `start` did.
    const unitSlugs = await this.learningService.listFinishedUnitSlugs(userId);
    if (unitSlugs.length === 0) {
      return null;
    }
    const marker = this.attempts.combinedUnitMarker(unitSlugs);
    return this.attempts.findAttempt(userId, marker, attemptNumber);
  }

  private async aggregateFinishedUnitContent(
    unitSlugs: readonly string[],
  ): Promise<{ unit: string; lessonIds: string[]; items: UnitContent['items']; exerciseTypes: string[] }> {
    const lessonIds: string[] = [];
    const seen = new Set<string>();
    const items: UnitContent['items'] = [];
    const exerciseTypes = new Set<string>();

    for (const unit of unitSlugs) {
      const content = await this.contentService.findUnitContent(unit);
      for (const lessonId of content.lessonIds) {
        if (!seen.has(lessonId)) {
          seen.add(lessonId);
          lessonIds.push(lessonId);
        }
      }
      for (const item of content.items) {
        const key = `${item.kind}:${item.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        items.push(item);
      }
      for (const type of content.exerciseTypes) exerciseTypes.add(type);
    }

    return { unit: 'combined', lessonIds, items, exerciseTypes: [...exerciseTypes] };
  }

  /**
   * Build the question set.
   *
   * Mirrors `CheckpointService.buildQuestions` in shape — same per-item
   * mapping, same weakness ranking, same distractor pool — and differs in
   * three places that are the whole reason this is a separate service:
   * the pool is multi-unit, the question count is `COMBINED_QUESTION_COUNT`,
   * and the seeds carry the unit-slug list so two learners with different
   * finished sets get different tests.
   */
  private async buildQuestions(
    pool: { unit: string; items: UnitContent['items']; exerciseTypes: string[] },
    unitSlugs: readonly string[],
    userId: string,
    exerciseType: 'multipleChoice' | 'wordReading',
  ): Promise<CheckpointQuestion[]> {
    const candidates = toChoices(pool.items, exerciseType);
    if (candidates.length === 0) return [];

    const ranked = await this.rankByWeakness(candidates, userId, unitSlugs);
    const selected = ranked.slice(0, COMBINED_QUESTION_COUNT);

    const seed = seedFrom('combined', userId, 'combined-order', selected.length);
    const random = mulberry32(seed);
    const asked = shuffle(selected, random);

    return asked.map((entry, index) =>
      this.toCombinedQuestion(entry, candidates, unitSlugs, userId, index),
    );
  }

  private async rankByWeakness(
    candidates: { choice: Choice; itemKind: ReturnType<typeof promptKindToContentKind>; kindQuestion: KindQuestion; exerciseType: 'multipleChoice' | 'wordReading' }[],
    userId: string,
    unitSlugs: readonly string[],
  ): Promise<typeof candidates> {
    const evidence = await this.learnerItemState.findEvidenceForItems(
      userId,
      candidates.map((entry) => ({ kind: entry.itemKind, id: new Types.ObjectId(entry.choice.id) })),
    );

    const random = mulberry32(seedFrom('combined', userId, 'combined-selection', unitSlugs.join(',')));

    const ranked = shuffle(candidates, random).map((entry) => {
      const row = evidence.get(`${entry.itemKind}:${entry.choice.id}`);
      const hasEvidence = row !== undefined && row.exposures > 0;
      return {
        entry,
        confidence: hasEvidence ? row.confidence : 0,
        withoutEvidence: hasEvidence ? 0 : 1,
      };
    });

    ranked.sort((a, b) => a.confidence - b.confidence || a.withoutEvidence - b.withoutEvidence);

    return ranked.map((row) => row.entry);
  }

  private toCombinedQuestion(
    entry: { choice: Choice; itemKind: ReturnType<typeof promptKindToContentKind>; kindQuestion: KindQuestion; exerciseType: 'multipleChoice' | 'wordReading' },
    candidates: { choice: Choice }[],
    unitSlugs: readonly string[],
    userId: string,
    index: number,
  ): CheckpointQuestion {
    const exerciseId = `1:${index}`;
    const base = {
      exerciseId,
      itemId: new Types.ObjectId(entry.choice.id),
      itemKind: entry.itemKind,
      promptKind: entry.kindQuestion.promptKind,
      prompt: entry.choice.prompt,
      question: entry.kindQuestion.question(entry.choice),
      answered: false,
      correct: false,
      responseTimeMs: null,
    };

    if (entry.exerciseType === 'wordReading') {
      return {
        ...base,
        exerciseType: 'wordReading',
        options: [],
        correctOptionId: '',
        correctValue: entry.choice.answer,
      };
    }

    // Distractor pool is the same union, deduped by `assembleOptions` by
    // answer text — romaji collisions across units are deduped the same way
    // they are within a single unit.
    const pool = candidates.map((candidate) => candidate.choice);
    const random = mulberry32(
      seedFrom('combined', userId, 'combined-options', unitSlugs.join(','), entry.choice.id),
    );
    const { options, correctOptionId } = assembleOptions(entry.choice, pool, pool, random);

    return {
      ...base,
      exerciseType: 'multipleChoice',
      options,
      correctOptionId,
      correctValue: entry.choice.answer,
    };
  }

  private recordEvidence(
    userId: string,
    question: CheckpointQuestion,
    correct: boolean,
    responseTimeMs?: number,
  ): void {
    this.learnerItemState
      .record({
        userId: new Types.ObjectId(userId),
        itemRef: { kind: question.itemKind, id: question.itemId },
        outcome: { correct, responseTimeMs },
        exerciseType: question.exerciseType,
        // Distinct from `'checkpoint'` so a 40-question across-units
        // assessment is not lumped with a 20-question per-unit one in the
        // learner model.
        sourceContext: 'combined',
      })
      .catch((err: unknown) => {
        this.logger.warn(
          `LearnerItemState record lost for user ${userId} ${question.itemKind} ` +
            `${question.itemId.toString()}: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
  }

  private grade(
    question: CheckpointQuestion,
    body: { optionId?: string; text?: string },
  ): { correct: boolean; selectedOptionId: string; selectedValue: string } {
    if (question.exerciseType === 'wordReading') {
      if (body.optionId !== undefined) {
        throw new BadRequestException('This question takes a typed romaji, not an option selection.');
      }
      if (typeof body.text !== 'string') {
        throw new BadRequestException('This question takes a typed romaji in the `text` field.');
      }

      const normalized = normaliseAnswer(body.text);
      return {
        correct: normalized === normaliseAnswer(question.correctValue),
        selectedOptionId: '',
        selectedValue: normalized,
      };
    }

    if (body.text !== undefined) {
      throw new BadRequestException('This question takes an option selection, not a typed answer.');
    }
    if (typeof body.optionId !== 'string') {
      throw new BadRequestException('This question takes an option id in the `optionId` field.');
    }

    const selected = question.options.find((option) => option.id === body.optionId);
    if (!selected) {
      throw new BadRequestException(
        `Option ${body.optionId} is not one of this question's ${question.options.length} options`,
      );
    }

    return {
      correct: selected.id === question.correctOptionId,
      selectedOptionId: selected.id,
      selectedValue: selected.value,
    };
  }

  private toSet(row: {
    attempt: number;
    unitSlugs: string[];
    questions: CheckpointQuestion[];
  }): CombinedTestSet {
    return {
      kind: 'combined',
      unitSlugs: row.unitSlugs,
      attempt: row.attempt,
      questionCount: row.questions.length,
      passMark: CHECKPOINT_PASS_MARK,
      questions: row.questions.map(toPublicCheckpointQuestion),
    };
  }

  private toResult(
    attempt: number,
    unitSlugs: string[],
    questions: CheckpointQuestion[],
    score: number,
    passed: boolean,
    xpAwarded: number,
  ): CombinedTestResult {
    const missed = questions.filter((q) => !q.correct);

    return {
      kind: 'combined',
      unitSlugs,
      attempt,
      questionCount: questions.length,
      correctCount: questions.filter((q) => q.correct).length,
      score,
      passMark: CHECKPOINT_PASS_MARK,
      passed,
      xpAwarded,
      missed: missed.map((q) => ({
        itemId: q.itemId.toString(),
        prompt: q.prompt,
        promptKind: q.promptKind,
        correctValue: q.correctValue,
        answered: q.answered,
      })),
    };
  }
}

/**
 * The wire shape of a combined test on the way out.
 *
 * Extends `CheckpointSet`/`CheckpointResult` shape-for-shape (the client
 * uses one renderer for both) and adds `kind` and `unitSlugs` so the
 * runner and the summary can say what was tested, not just that something
 * was.
 */
export interface CombinedTestSet extends Omit<CheckpointSet, 'unit'> {
  kind: 'combined';
  unitSlugs: string[];
}

export interface CombinedTestResult extends Omit<CheckpointResult, 'unit'> {
  kind: 'combined';
  unitSlugs: string[];
}

/**
 * Mirror `CheckpointService.pickExerciseType`: a unit that teaches typing is
 * tested by typing. Across units the precedence is "if any finished unit
 * teaches typing, type", so a learner who just finished a word-reading unit
 * does not get a typing-free surprise.
 */
function pickExerciseType(pool: { exerciseTypes: readonly string[] }): 'multipleChoice' | 'wordReading' {
  if (pool.exerciseTypes.includes('wordReading')) return 'wordReading';
  if (pool.exerciseTypes.includes('multipleChoice')) return 'multipleChoice';

  throw new UnprocessableEntityException(
    `Finished units do not offer a supported exercise type (have: ${pool.exerciseTypes.join(', ') || 'none'})`,
  );
}

/**
 * Flatten the union's items into candidate questions, the same way
 * `CheckpointService.toChoices` does for one unit. The duplicate logic is
 * intentional: a 60-line helper duplicated is cheaper than a 60-line helper
 * that takes a "is this a combined test" flag.
 */
function toChoices(
  items: UnitContent['items'],
  exerciseType: 'multipleChoice' | 'wordReading',
): {
  choice: Choice;
  itemKind: ReturnType<typeof promptKindToContentKind>;
  kindQuestion: KindQuestion;
  exerciseType: 'multipleChoice' | 'wordReading';
}[] {
  if (exerciseType === 'wordReading') {
    return items
      .filter(isVocab)
      .filter((item) => typeof item.romaji === 'string' && item.romaji.length > 0)
      .map((item) => ({
        choice: { id: item.id, prompt: item.lemma, answer: item.romaji as string },
        itemKind: 'vocab' as const,
        kindQuestion: WORD_READING_QUESTION,
        exerciseType: 'wordReading' as const,
      }));
  }

  const entries: {
    choice: Choice;
    itemKind: ReturnType<typeof promptKindToContentKind>;
    kindQuestion: KindQuestion;
    exerciseType: 'multipleChoice' | 'wordReading';
  }[] = [];
  for (const item of items) {
    if (isKana(item)) {
      entries.push({
        choice: kanaChoice(item),
        itemKind: 'kana',
        kindQuestion: KANA_QUESTION,
        exerciseType: 'multipleChoice',
      });
    } else if (isVocab(item)) {
      entries.push({
        choice: vocabChoice(item),
        itemKind: 'vocab',
        kindQuestion: VOCAB_QUESTION,
        exerciseType: 'multipleChoice',
      });
    } else if (isGrammar(item)) {
      for (const choice of toGrammarChoice(item)) {
        entries.push({
          choice,
          itemKind: 'grammar',
          kindQuestion: GRAMMAR_QUESTION,
          exerciseType: 'multipleChoice',
        });
      }
    } else if (isKanji(item)) {
      for (const choice of toKanjiChoice(item)) {
        entries.push({
          choice,
          itemKind: 'kanji',
          kindQuestion: KANJI_QUESTION,
          exerciseType: 'multipleChoice',
        });
      }
    }
  }

  return entries;
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}
