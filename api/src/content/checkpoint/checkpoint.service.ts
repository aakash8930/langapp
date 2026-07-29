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
import { CheckpointAttemptsService, CHECKPOINT_PASS_MARK } from '../../learning/checkpoint-attempts.service';
import { LearnerItemStateService } from '../../learning/learner-item-state.service';
import { LearningService } from '../../learning/learning.service';
import { CheckpointQuestion } from '../../learning/schemas/unit-checkpoint-attempt.schema';
import { UserService } from '../../user/user.service';
import { ContentService, UnitContent } from '../content.service';
import { AnswerResult } from '../dto/exercise-response.dto';
import {
  CheckpointResult,
  CheckpointSet,
  toPublicCheckpointQuestion,
} from '../dto/checkpoint-response.dto';
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
  promptKindToSrsKind,
  toGrammarChoice,
  toKanjiChoice,
  VOCAB_QUESTION,
  vocabChoice,
  WORD_READING_QUESTION,
} from '../exercise/question-builder';

/** How many questions a checkpoint asks, at most. */
export const CHECKPOINT_QUESTION_COUNT = 20;

/** Awarded the first time a learner passes a unit. */
export const XP_PER_CHECKPOINT_PASS = 50;

/** Awarded for passing a unit already passed. */
export const XP_PER_CHECKPOINT_REPEAT = 5;

/**
 * The end-of-unit checkpoint (test).
 *
 * ## How it differs from a lesson's exercises, and why
 *
 * `ExerciseService` generates from one lesson, stores nothing, and re-derives
 * the set at answer time from `(lesson, user, attempt)`. This does the
 * opposite on all three counts, and each is forced by the fact that a
 * checkpoint is **scored**:
 *
 *  - **Whole unit, not one lesson.** The point is to test retention across the
 *    unit rather than recall of the lesson just finished.
 *  - **Sampled and weighted.** `vocab-n5` is 512 items; nobody sits a 512
 *    question test. Twenty are drawn, weakest-first from the learner model, so
 *    the test spends its questions where the learner is actually shaky.
 *  - **Persisted.** Because the sample depends on the learner model, which
 *    moves as they answer, the set is not reproducible from a seed — so it is
 *    stored at start and read back, rather than regenerated.
 *
 * ## One shot per question
 *
 * The lesson flow re-asks a question until the learner gets it right, which is
 * good teaching and would make a test meaningless. Here the first answer is
 * the answer. Nothing blocks progress on the result: failing pulls the missed
 * items forward in the SRS and awards nothing, which is a consequence rather
 * than a punishment (Phase 2 §3.1 removed hearts for that reason).
 */
@Injectable()
export class CheckpointService {
  private readonly logger = new Logger(CheckpointService.name);

  constructor(
    private readonly contentService: ContentService,
    @Inject(forwardRef(() => CheckpointAttemptsService))
    private readonly attempts: CheckpointAttemptsService,
    @Inject(forwardRef(() => LearnerItemStateService))
    private readonly learnerItemState: LearnerItemStateService,
    // For pulling missed items forward in the SRS. `scheduleItemDue` writes
    // `due` and nothing else, which is the rule ADR-003 turns on: a checkpoint
    // answer is not a graded review and must not reach FSRS's model.
    @Inject(forwardRef(() => LearningService))
    private readonly learningService: LearningService,
    private readonly userService: UserService,
  ) {}

  /**
   * Start a checkpoint, or resume the one already open.
   *
   * Resuming rather than regenerating is what closes the re-roll hole: a
   * learner who does not like their questions cannot abandon the attempt and
   * ask for another set, because this returns the same one until it is
   * submitted. It also means a refresh mid-test is free.
   */
  async start(unit: string, userId: string): Promise<CheckpointSet> {
    const open = await this.attempts.findOpen(userId, unit);
    if (open) {
      return {
        unit: open.unit,
        attempt: open.attempt,
        questionCount: open.questions.length,
        passMark: CHECKPOINT_PASS_MARK,
        questions: open.questions.map(toPublicCheckpointQuestion),
      };
    }

    const content = await this.contentService.findUnitContent(unit);
    if (content.lessonIds.length === 0) {
      throw new NotFoundException(`Unknown unit: ${unit}`);
    }

    const questions = await this.buildQuestions(content, userId);
    if (questions.length === 0) {
      throw new UnprocessableEntityException(
        `Unit ${unit} has no kana, vocabulary, grammar or kanji items to test`,
      );
    }

    const created = await this.attempts.create(userId, unit, questions);

    return {
      unit: created.unit,
      attempt: created.attempt,
      questionCount: created.questions.length,
      passMark: CHECKPOINT_PASS_MARK,
      questions: created.questions.map(toPublicCheckpointQuestion),
    };
  }

  /**
   * Grade one answer, once.
   *
   * Answering a question that was already answered returns the stored verdict
   * unchanged rather than 400ing — a double-tap or a retried request should not
   * look like an error, and it must not be able to overwrite a wrong answer
   * with a right one.
   */
  async answer(
    unit: string,
    attemptNumber: number,
    exerciseId: string,
    userId: string,
    body: { optionId?: string; text?: string; responseTimeMs?: number },
  ): Promise<AnswerResult> {
    const attempt = await this.attempts.findAttempt(userId, unit, attemptNumber);
    if (!attempt) {
      throw new NotFoundException(`No attempt ${attemptNumber} at ${unit}`);
    }
    if (attempt.submittedAt !== null) {
      throw new BadRequestException('This checkpoint has already been submitted.');
    }

    const question = attempt.questions.find((q) => q.exerciseId === exerciseId);
    if (!question) {
      throw new BadRequestException(`Unknown exercise: ${exerciseId}`);
    }

    const graded = this.grade(question, body);

    // `recordAnswer` filters on `answered: false`, so this is the one-shot
    // gate. A `false` return means the question was already answered and the
    // stored verdict stands.
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
      // A checkpoint does not reveal the right answer per question — the
      // learner is under test, and showing it would turn the remaining
      // questions about the same item into a lookup. The whole key comes back
      // at submit, which is where a test is allowed to teach.
      correctOptionId: '',
      correctValue: '',
      prompt: question.prompt,
    };
  }

  /**
   * Close the attempt, score it, and act on the result.
   *
   * Unanswered questions count as wrong. Submitting early is therefore
   * allowed and costs what it should — a learner who bails at question three
   * scores 3/20, not 3/3.
   */
  async submit(unit: string, attemptNumber: number, userId: string): Promise<CheckpointResult> {
    const attempt = await this.attempts.findAttempt(userId, unit, attemptNumber);
    if (!attempt) {
      throw new NotFoundException(`No attempt ${attemptNumber} at ${unit}`);
    }

    const total = attempt.questions.length;
    const correctCount = attempt.questions.filter((q) => q.correct).length;
    const score = total > 0 ? round2(correctCount / total) : 0;
    const passed = score >= CHECKPOINT_PASS_MARK;

    // Whether this is the *first* pass has to be read before the attempt is
    // closed, or this attempt is the one it finds.
    const passedBefore = await this.attempts.hasPassed(userId, unit);

    const closed = await this.attempts.submit(attempt._id, score, passed);
    if (!closed) {
      // Already submitted. Report the stored verdict and award nothing — the
      // filter on `submittedAt: null` is what makes the XP exactly-once.
      return this.resultFor(attempt.unit, attempt.attempt, attempt.questions, attempt.score ?? score, attempt.passed ?? passed, 0);
    }

    const missed = attempt.questions.filter((q) => !q.correct);
    await this.scheduleMissed(userId, missed);

    let xpAwarded = 0;
    if (passed) {
      xpAwarded = passedBefore ? XP_PER_CHECKPOINT_REPEAT : XP_PER_CHECKPOINT_PASS;
      await this.userService.awardXp(userId, xpAwarded);
    }

    return this.resultFor(attempt.unit, attempt.attempt, attempt.questions, score, passed, xpAwarded);
  }

  private resultFor(
    unit: string,
    attempt: number,
    questions: CheckpointQuestion[],
    score: number,
    passed: boolean,
    xpAwarded: number,
  ): CheckpointResult {
    const missed = questions.filter((q) => !q.correct);

    return {
      unit,
      attempt,
      questionCount: questions.length,
      correctCount: questions.filter((q) => q.correct).length,
      score,
      passMark: CHECKPOINT_PASS_MARK,
      passed,
      xpAwarded,
      // The answer key, released now that the attempt is closed. This is the
      // teaching half of a test and the only place these fields leave the
      // service.
      missed: missed.map((q) => ({
        itemId: q.itemId.toString(),
        prompt: q.prompt,
        promptKind: q.promptKind,
        correctValue: q.correctValue,
        answered: q.answered,
      })),
      scheduledForReview: missed.length,
    };
  }

  /**
   * Pull every missed item forward in the SRS.
   *
   * `scheduleItemDue` writes `due` and nothing else and never throws — the
   * precedent set by `scheduleMissedWords` for chat corrections. A checkpoint
   * answer is evidence about the learner, not a graded review, so it must not
   * touch `stability`, `difficulty`, `state`, `reps` or `lapses`.
   *
   * This is the whole consequence of failing. Nothing is locked, no progress is
   * taken away: the items the learner got wrong come back sooner, which is what
   * a test result is *for*.
   */
  private async scheduleMissed(userId: string, missed: CheckpointQuestion[]): Promise<void> {
    await Promise.all(
      missed.map((question) =>
        this.learningService
          .scheduleItemDue(userId, question.itemId.toString(), question.itemKind)
          .catch((err: unknown) => {
            this.logger.warn(
              `SRS scheduling lost for user ${userId} item ${question.itemId.toString()}: ${
                err instanceof Error ? err.message : String(err)
              }`,
            );
          }),
      ),
    );
  }

  /**
   * Record the answer as learner-model evidence (§5.2 / ADR-003).
   *
   * Fire-and-forget: `record()` never throws, and losing an evidence row must
   * not fail the learner's answer. `sourceContext: 'checkpoint'` keeps
   * one-shot test evidence distinguishable from lesson evidence, which is
   * "right eventually".
   */
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
        sourceContext: 'checkpoint',
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

  /**
   * Sample the unit and build the questions.
   *
   * The sampling order is the pedagogically interesting part; see
   * `rankByWeakness`. Everything after it is the same assembly the lesson
   * exercises use, from the same `question-builder` module.
   */
  private async buildQuestions(
    content: UnitContent,
    userId: string,
  ): Promise<CheckpointQuestion[]> {
    const typed = pickExerciseType(content.exerciseTypes);
    const candidates = toChoices(content.items, typed);
    if (candidates.length === 0) return [];

    const ranked = await this.rankByWeakness(candidates, userId, content.unit);
    const selected = ranked.slice(0, CHECKPOINT_QUESTION_COUNT);

    // The *asking* order is shuffled independently of the selection order, so
    // the test does not open with the learner's worst item and walk upward —
    // which would tell them exactly what the model thinks of them.
    const random = mulberry32(seedFrom(content.unit, userId, 'checkpoint-order', selected.length));
    const asked = shuffle(selected, random);

    return asked.map((entry, index) =>
      this.toCheckpointQuestion(entry, candidates, content, userId, index),
    );
  }

  /**
   * Order the unit's items worst-first, so the twenty that get asked are the
   * twenty worth asking.
   *
   * One comparator, two keys:
   *
   *  1. **Confidence ascending, where an item with no evidence counts as 0.**
   *     The learner model is the whole reason this ranking exists — a
   *     checkpoint that drew twenty items at random would mostly re-test
   *     things already mastered. Never-practised items sort to the front with
   *     the demonstrably weak ones, which is what catches a learner who
   *     skipped ahead.
   *  2. **On a tie, an item with evidence comes before one without.** Both are
   *     worth asking; a demonstrated failure is the stronger signal, so it
   *     goes first when the scores are level.
   *
   * Within equal keys the order is a deterministic shuffle rather than an id
   * sort, so two learners with equally empty models do not sit identical
   * tests. `sort` is stable in V8 and the input is shuffled first, so ties
   * keep the shuffled order rather than falling back to insertion order. Ties
   * are the common case, not the edge one: most of a fresh model is exactly 0.
   */
  private async rankByWeakness(
    candidates: ChoiceEntry[],
    userId: string,
    unit: string,
  ): Promise<ChoiceEntry[]> {
    const evidence = await this.learnerItemState.findEvidenceForItems(
      userId,
      candidates.map((entry) => ({ kind: entry.itemKind, id: new Types.ObjectId(entry.choice.id) })),
    );

    const random = mulberry32(seedFrom(unit, userId, 'checkpoint-selection'));

    const ranked = shuffle(candidates, random).map((entry) => {
      const row = evidence.get(`${entry.itemKind}:${entry.choice.id}`);
      const hasEvidence = row !== undefined && row.exposures > 0;

      return {
        entry,
        confidence: hasEvidence ? row.confidence : 0,
        // `false` sorts before `true` once mapped to 0/1 — evidence first.
        withoutEvidence: hasEvidence ? 0 : 1,
      };
    });

    ranked.sort(
      (a, b) => a.confidence - b.confidence || a.withoutEvidence - b.withoutEvidence,
    );

    return ranked.map((row) => row.entry);
  }

  private toCheckpointQuestion(
    entry: ChoiceEntry,
    candidates: ChoiceEntry[],
    content: UnitContent,
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

    // Distractors come from the whole unit — unlike a lesson question, which
    // prefers its own lesson's items (OPEN-ITEMS #29). A checkpoint *is* the
    // unit, so the unit pool is the tight pool here, not the loose one. Both
    // arguments are the same list for that reason.
    const pool = candidates.map((candidate) => candidate.choice);
    const random = mulberry32(
      seedFrom(content.unit, userId, 'checkpoint-options', entry.choice.id),
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
}

/** A candidate question: the flattened item plus how it should be asked. */
interface ChoiceEntry {
  choice: Choice;
  itemKind: ReturnType<typeof promptKindToSrsKind>;
  kindQuestion: KindQuestion;
  exerciseType: 'multipleChoice' | 'wordReading';
}

/**
 * Flatten a unit's items into candidate questions.
 *
 * Unlike `ExerciseService.buildMultipleChoiceSet`, which picks a single style
 * for the lesson (kana, else vocab, else grammar, else kanji), this keeps every
 * kind it finds. A unit is homogeneous in the seeded content today, but a
 * checkpoint over a mixed unit should test all of it rather than silently drop
 * whichever kinds sorted later.
 */
function toChoices(
  items: UnitContent['items'],
  exerciseType: 'multipleChoice' | 'wordReading',
): ChoiceEntry[] {
  if (exerciseType === 'wordReading') {
    // Word-reading units are vocabulary units in disguise: the lemma is the
    // prompt and the romaji is what the learner types. An item without romaji
    // cannot be asked this way and drops out.
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

  const entries: ChoiceEntry[] = [];
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

/**
 * Which shape the unit's questions take. Same precedence as the lesson path:
 * a unit that teaches typing is tested by typing.
 */
function pickExerciseType(declared: readonly string[]): 'multipleChoice' | 'wordReading' {
  if (declared.includes('wordReading')) return 'wordReading';
  if (declared.includes('multipleChoice')) return 'multipleChoice';

  throw new UnprocessableEntityException(
    `Unit does not offer a supported exercise type (has: ${declared.join(', ') || 'none'})`,
  );
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}
