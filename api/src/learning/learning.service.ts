import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AnalyticsService } from '../analytics/analytics.service';
import { ContentService } from '../content/content.service';
import { ResolvedItem } from '../content/dto/lesson-response.dto';
import {
  GEMS_PER_LESSON_COMPLETION,
  GEMS_PER_LESSON_PRACTICE,
} from '../user/gamification/hearts';
import { UserService } from '../user/user.service';
import { CompleteLessonResponse } from './dto/complete-lesson-response.dto';
import { ExerciseAttemptsService } from './exercise-attempts.service';
import { newCardFields } from './fsrs-card.mapper';
import { LessonCompletion, LessonCompletionDocument } from './schemas/lesson-completion.schema';
import { SrsCard, SrsCardDocument } from './schemas/srs-card.schema';

/**
 * Awarded once per lesson, on the completion that creates the record.
 * Every completion after that earns the smaller `XP_PER_LESSON_PRACTICE`
 * (env-configurable), so replaying the POST can't farm XP — OPEN-ITEMS #0.
 */
export const XP_PER_LESSON_COMPLETION = 10;

/** Fallback when XP_PER_LESSON_PRACTICE is absent; the config module validates it. */
export const DEFAULT_XP_PER_LESSON_PRACTICE = 2;

/** Mongo duplicate-key error. */
const DUPLICATE_KEY = 11000;

/**
 * Owns `srsCards`. Reaches content, users and analytics only through their
 * exported services — never their collections (§4).
 */
@Injectable()
export class LearningService {
  private readonly logger = new Logger(LearningService.name);
  private readonly xpPerPractice: number;

  constructor(
    @InjectModel(SrsCard.name) private readonly srsCardModel: Model<SrsCardDocument>,
    @InjectModel(LessonCompletion.name)
    private readonly lessonCompletionModel: Model<LessonCompletionDocument>,
    private readonly contentService: ContentService,
    private readonly userService: UserService,
    private readonly analyticsService: AnalyticsService,
    private readonly exerciseAttempts: ExerciseAttemptsService,
    config: ConfigService,
  ) {
    this.xpPerPractice =
      config.get<number>('XP_PER_LESSON_PRACTICE') ?? DEFAULT_XP_PER_LESSON_PRACTICE;
  }

  async completeLesson(userId: string, lessonId: string): Promise<CompleteLessonResponse> {
    // Reuses the validated read path — 400 on a malformed id, 404 if absent.
    // `items` excludes refs whose content is gone, so no card is created for
    // an item the learner could never actually review.
    const lesson = await this.contentService.findLessonById(lessonId);

    // Two preconditions before any XP cards or completion rows are written.
    // Both are 409 Conflict: the request is well-formed, but the user's state
    // does not allow it. The client derives lesson lock state from
    // `completedLessonIds` and disables access itself — these server checks
    // are the defence for the API-spoof paths (curl, replay, future client
    // that forgets the prerequisite check).
    await this.assertPrerequisitesMet(userId, lesson.prerequisiteLessonIds);
    await this.assertUserEngagedWithLesson(userId, lesson.id);

    const created = await this.seedCards(userId, lesson.items);

    // The completion record is the source of truth for "has this been done
    // before", not `created > 0`: a learner can already hold every card from a
    // different lesson that shares items, which would make a genuine first
    // completion look like a replay.
    const completion = await this.recordCompletion(userId, lesson.id);
    const firstCompletion = completion.timesCompleted === 1;

    // Full award once, practice award thereafter (OPEN-ITEMS #0). The upsert is
    // atomic, so two concurrent first completions produce timesCompleted 1 and 2
    // — exactly one of them can be the first, and only it gets the full award.
    const xpAwarded = firstCompletion ? XP_PER_LESSON_COMPLETION : this.xpPerPractice;

    const user = await this.userService.awardXp(userId, xpAwarded);

    // Gems track XP's shape — full award once, a smaller one on every repeat —
    // for the same anti-farming reason (#0). Awarded but not awaited into the
    // response's correctness: a lost gem credit is a small unfairness, a failed
    // completion is not.
    const gemsAwarded = firstCompletion ? GEMS_PER_LESSON_COMPLETION : GEMS_PER_LESSON_PRACTICE;
    await this.userService.awardGems(userId, gemsAwarded).catch((err: unknown) => {
      this.logger.warn(
        `gem award lost for user ${userId}: ` +
          `${err instanceof Error ? err.message : String(err)}`,
      );
    });

    // Deliberately last, and guarded here as well as inside AnalyticsService:
    // cards and XP are already committed by this point, so a failure to log
    // must not turn a successful completion into an error response (§7). The
    // duplicated catch is intentional — the guarantee shouldn't depend on
    // another module's internals staying non-throwing.
    await this.analyticsService
      .record({
        userId,
        type: 'lesson.completed',
        payload: {
          lessonId: lesson.id,
          unit: lesson.unit,
          itemCount: lesson.items.length,
          cardsCreated: created,
          xpAwarded,
          gemsAwarded,
          firstCompletion,
          timesCompleted: completion.timesCompleted,
        },
      })
      .catch((err: unknown) => {
        this.logger.warn(
          `lesson.completed event lost for user ${userId}: ` +
            `${err instanceof Error ? err.message : String(err)}`,
        );
      });

    return {
      lessonId: lesson.id,
      title: lesson.title,
      cardsCreated: created,
      cardsAlreadyPresent: lesson.items.length - created,
      xpAwarded,
      gemsAwarded,
      firstCompletion,
      totalXp: user.gamification.xp,
    };
  }

  /**
   * Gate #1: every prerequisite lesson id must be in this user's completed set.
   *
   * `prerequisiteLessonIds` is the order the lesson tree enforces; comparing
   * against `findCompletedLessonIds()` is the natural test. The error message
   * names the missing ids so the client can show them — that's the only
   * structured signal available, since `api/CLAUDE.md` forbids a custom error
   * framework and the response is a flat `{ statusCode, message, error }`.
   *
   * Empty prerequisite list short-circuits — no read, no throw — so the common
   * case (early lessons) costs nothing.
   */
  private async assertPrerequisitesMet(
    userId: string,
    prerequisiteLessonIds: string[],
  ): Promise<void> {
    if (prerequisiteLessonIds.length === 0) return;

    const completed = new Set(await this.findCompletedLessonIds(userId));
    const missing = prerequisiteLessonIds.filter((id) => !completed.has(id));
    if (missing.length === 0) return;

    throw new ConflictException(
      `Complete these lessons first: ${missing.join(', ')}`,
    );
  }

  /**
   * Gate #2: at least one exercise answered for this lesson, in any attempt.
   *
   * "Any answer" is the smallest useful gate — it stops the open-and-complete
   * path without forcing the learner to 100% a lesson they're stuck on. The
   * client reaches the "Finish lesson" button only after answering the last
   * question, so honest users always satisfy this gate; the gate fires only
   * for API-spoof paths (curl, replay, future clients that skip exercises).
   *
   * Index `{userId, lessonId}` makes the count an O(1) seek at Phase 0 volume.
   */
  private async assertUserEngagedWithLesson(userId: string, lessonId: string): Promise<void> {
    const attempts = await this.exerciseAttempts.countAttemptsForLesson(userId, lessonId);
    if (attempts === 0) {
      throw new ConflictException(
        'Answer at least one exercise before completing this lesson.',
      );
    }
  }

  /**
   * Creates a card for each item the user doesn't already have one for.
   *
   * Two layers of protection against duplicates: this filters against existing
   * cards first (the common path, and it keeps the insert small), and the
   * unique index catches anything that races past it. `ordered: false` means one
   * duplicate doesn't abort the rest of the batch.
   */
  private async seedCards(userId: string, items: ResolvedItem[]): Promise<number> {
    if (items.length === 0) {
      return 0;
    }

    const userObjectId = new Types.ObjectId(userId);
    const itemIds = items.map((item) => new Types.ObjectId(item.id));

    const existing = await this.srsCardModel
      .find({ userId: userObjectId, 'itemRef.id': { $in: itemIds } })
      .select('itemRef')
      .exec();

    const existingKeys = new Set(
      existing.map((card) => `${card.itemRef.kind}:${card.itemRef.id.toString()}`),
    );

    const now = new Date();
    const toCreate = items
      .filter((item) => !existingKeys.has(`${item.kind}:${item.id}`))
      .map((item) => ({
        userId: userObjectId,
        itemRef: { kind: item.kind, id: new Types.ObjectId(item.id) },
        ...newCardFields(now),
      }));

    if (toCreate.length === 0) {
      return 0;
    }

    try {
      const inserted = await this.srsCardModel.insertMany(toCreate, { ordered: false });
      return inserted.length;
    } catch (err) {
      // A concurrent completion won the race for some cards. Those are exactly
      // the ones we wanted to exist anyway, so count what actually landed.
      if (isDuplicateKeyError(err)) {
        const writeErrors = (err as { writeErrors?: unknown[] }).writeErrors?.length ?? 0;
        const inserted = toCreate.length - writeErrors;
        this.logger.warn(
          `Concurrent completion for user ${userId}: ${writeErrors} card(s) already existed`,
        );
        return Math.max(0, inserted);
      }
      throw err;
    }
  }

  /**
   * One row per (user, lesson). Upsert so a repeat completion bumps the counter
   * instead of adding a row — `$setOnInsert` keeps `firstCompletedAt` honest.
   *
   * Returns the document *after* the increment, because `timesCompleted === 1`
   * is what decides the XP award. Doing that from the write itself, rather than
   * a read beforehand, is what makes it safe under concurrency: the counter is
   * assigned by Mongo, so two racing completions cannot both see 1.
   */
  private async recordCompletion(
    userId: string,
    lessonId: string,
  ): Promise<LessonCompletionDocument> {
    const now = new Date();

    const completion = await this.lessonCompletionModel
      .findOneAndUpdate(
        { userId: new Types.ObjectId(userId), lessonId: new Types.ObjectId(lessonId) },
        {
          $inc: { timesCompleted: 1 },
          $set: { lastCompletedAt: now },
          $setOnInsert: { firstCompletedAt: now },
        },
        { upsert: true, new: true },
      )
      .exec();

    // `new: true` with `upsert: true` always yields a document; this narrows the
    // type and would catch a driver-level surprise rather than award XP off null.
    if (!completion) {
      throw new Error(`Completion upsert returned nothing for lesson ${lessonId}`);
    }

    return completion;
  }

  /**
   * Distinct lessons this user has completed at least once.
   *
   * Returns ids rather than a count because a client cannot derive lesson lock
   * state without them: prerequisites are expressed as lesson ids, so a bare
   * number answers nothing. /me/progress takes its count off `.length`, so the
   * two can never disagree.
   *
   * Phase 0 ships a few dozen lessons, so the array stays small. If content
   * volume ever makes that untrue, lock state belongs on the server rather than
   * this growing unbounded.
   */
  async findCompletedLessonIds(userId: string): Promise<string[]> {
    const rows = await this.lessonCompletionModel
      .find({ userId: new Types.ObjectId(userId) })
      .select('lessonId')
      .lean<{ lessonId: Types.ObjectId }[]>()
      .exec();

    return rows.map((row) => row.lessonId.toString());
  }

  /**
   * §7 step 7: schedule words the learner got wrong in conversation.
   *
   * `texts` are the free-text fragments of a chat correction — the `span` the
   * learner wrote and the `fix` they should have written. Both are matched, not
   * just the fix: a span is often a correct word used wrongly (わたしわ contains
   * わたし), and a span misspelled beyond recognition simply matches nothing.
   *
   * Two outcomes per matched word, and the distinction is the whole design:
   *
   * - **No card yet** → create one, due now. Unambiguously right: the learner has
   *   just demonstrated the word matters to them and nothing is tracking it.
   * - **Card already exists** → pull `due` forward to now if it is later, and
   *   change *nothing else*. `stability`, `difficulty`, `state`, `reps` and
   *   `lapses` are FSRS's model of this learner, and the only honest way to move
   *   them is a real grade. Manufacturing one from "the tutor corrected you"
   *   would feed the scheduler an observation that never happened and quietly
   *   degrade every interval it computes afterwards.
   *
   * So this makes a word come up sooner; it never claims to know how well the
   * learner knows it. That is the most a correction can honestly say.
   *
   * Never throws. A chat turn has already cost a provider call and been
   * persisted by the time this runs, and failing the request over a scheduling
   * nicety would lose the learner's reply — same failure semantics as
   * `AnalyticsService.record`.
   */
  async scheduleMissedWords(
    userId: string,
    texts: string[],
  ): Promise<{ cardsCreated: number; cardsAdvanced: number }> {
    try {
      const matched = await this.contentService.findVocabInTexts(texts);
      if (matched.length === 0) {
        return { cardsCreated: 0, cardsAdvanced: 0 };
      }

      const userObjectId = new Types.ObjectId(userId);
      const now = new Date();

      const existing = await this.srsCardModel
        .find({
          userId: userObjectId,
          'itemRef.kind': 'vocab',
          'itemRef.id': { $in: matched.map((doc) => doc._id) },
        })
        .select('itemRef due')
        .exec();

      const existingIds = new Set(existing.map((card) => card.itemRef.id.toString()));

      const toCreate = matched
        .filter((doc) => !existingIds.has(doc._id.toString()))
        .map((doc) => ({
          userId: userObjectId,
          itemRef: { kind: 'vocab' as const, id: doc._id },
          ...newCardFields(now),
        }));

      let cardsCreated = 0;
      if (toCreate.length > 0) {
        try {
          const inserted = await this.srsCardModel.insertMany(toCreate, { ordered: false });
          cardsCreated = inserted.length;
        } catch (err) {
          // Same race as seedCards: a concurrent completion may have created the
          // card we wanted. That is the desired end state, so count what landed.
          if (!isDuplicateKeyError(err)) throw err;
          const writeErrors = (err as { writeErrors?: unknown[] }).writeErrors?.length ?? 0;
          cardsCreated = Math.max(0, toCreate.length - writeErrors);
        }
      }

      // Only cards that are not already due — pushing an already-due card's date
      // to now would be a no-op write, and moving it *later* would be wrong.
      const notYetDue = existing.filter((card) => card.due > now).map((card) => card._id);

      let cardsAdvanced = 0;
      if (notYetDue.length > 0) {
        const result = await this.srsCardModel
          .updateMany({ _id: { $in: notYetDue } }, { $set: { due: now } })
          .exec();
        cardsAdvanced = result.modifiedCount;
      }

      return { cardsCreated, cardsAdvanced };
    } catch (err) {
      this.logger.warn(
        `Could not schedule missed words for user ${userId}: ${
          err instanceof Error ? err.message : 'unknown error'
        }`,
      );
      return { cardsCreated: 0, cardsAdvanced: 0 };
    }
  }

  async countCards(userId: string): Promise<number> {
    return this.srsCardModel.countDocuments({ userId: new Types.ObjectId(userId) }).exec();
  }
}

function isDuplicateKeyError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const code = (err as { code?: number }).code;
  // insertMany with ordered:false reports a BulkWriteError wrapping per-doc codes.
  const writeErrors = (err as { writeErrors?: { err?: { code?: number } }[] }).writeErrors;
  return code === DUPLICATE_KEY || !!writeErrors?.some((e) => e.err?.code === DUPLICATE_KEY);
}
