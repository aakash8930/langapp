import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { AnalyticsService } from '../analytics/analytics.service';
import { ContentService } from '../content/content.service';
import { UserService } from '../user/user.service';
import { CompleteLessonResponse } from './dto/complete-lesson-response.dto';
import { CheckpointAttemptsService } from './checkpoint-attempts.service';
import { ExerciseAttemptsService } from './exercise-attempts.service';
import { LearnerItemStateService } from './learner-item-state.service';
import { LessonCompletion, LessonCompletionDocument } from './schemas/lesson-completion.schema';

/**
 * Awarded once per lesson, on the completion that creates the record.
 * Every completion after that earns the smaller `XP_PER_LESSON_PRACTICE`
 * (env-configurable), so replaying the POST can't farm XP — OPEN-ITEMS #0.
 */
export const XP_PER_LESSON_COMPLETION = 10;

/** Fallback when XP_PER_LESSON_PRACTICE is absent; the config module validates it. */
export const DEFAULT_XP_PER_LESSON_PRACTICE = 2;

/**
 * Owns lesson completions and coordinates exercise completion, XP, and analytics.
 */
@Injectable()
export class LearningService {
  private readonly logger = new Logger(LearningService.name);
  private readonly xpPerPractice: number;

  constructor(
    @InjectModel(LessonCompletion.name)
    private readonly lessonCompletionModel: Model<LessonCompletionDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly contentService: ContentService,
    private readonly userService: UserService,
    private readonly analyticsService: AnalyticsService,
    private readonly exerciseAttempts: ExerciseAttemptsService,
    // §5.2 / ADR-003: the pedagogical model for each `(user, item)` pair.
    // Used here only as the consumer of `scheduleMissedWords` — every other
    // write path lives in `ExerciseService` / `ReviewService` and goes through
    // their constructors. Adding the dependency here, rather than reaching
    // across into `learning/` from `chat/`, keeps the §4 "modules touch each
    // other's collections through services only" rule.
    private readonly learnerItemStateService: LearnerItemStateService,
    // Cascade only. The checkpoint's own reads and writes are driven from
    // `CheckpointService`; this module holds the reference so `DELETE /me`
    // erases the collection along with everything else `learning` owns.
    private readonly checkpointAttempts: CheckpointAttemptsService,
    config: ConfigService,
  ) {
    this.xpPerPractice =
      config.get<number>('XP_PER_LESSON_PRACTICE') ?? DEFAULT_XP_PER_LESSON_PRACTICE;
  }

  async completeLesson(userId: string, lessonId: string): Promise<CompleteLessonResponse> {
    // Reuses the validated read path — 400 on a malformed id, 404 if absent.
    const lesson = await this.contentService.findLessonById(lessonId);

    // Two preconditions before any XP or completion rows are written.
    // Both are 409 Conflict: the request is well-formed, but the user's state
    // does not allow it. The client derives lesson lock state from
    // `completedLessonIds` and disables access itself — these server checks
    // are the defence for the API-spoof paths (curl, replay, future client
    // that forgets the prerequisite check).
    await this.assertPrerequisitesMet(userId, lesson.prerequisiteLessonIds);
    await this.assertUserAnsweredEverythingCorrectly(userId, lesson.id);

    // The completion record is the source of truth for "has this been done
    // before", not `created > 0`: a learner can already hold every card from a
    // different lesson that shares items, which would make a genuine first
    // completion look like a replay.
    const completion = await this.recordCompletion(userId, lesson.id);
    const firstCompletion = completion.timesCompleted === 1;

    // Phase 0 — Data foundation. On first completion only, union the lesson's
    // kana items into `learningState.knownKana`. Re-completions add nothing the
    // learner did not already have, and going down this branch on every
    // completion would spend a write per replay for no gain. `$addToSet`
    // inside `UserService.addKnownKana` is the idempotency backstop that makes
    // a lesson teaching *no* kana (e.g. vocab-only checkpoints) free.
    if (firstCompletion) {
      const newKana: string[] = [];
      const seen = new Set<string>();
      for (const item of lesson.items) {
        if (item.kind !== 'kana') {
          continue;
        }
        if (seen.has(item.kana)) {
          continue;
        }
        seen.add(item.kana);
        newKana.push(item.kana);
      }
      if (newKana.length > 0) {
        await this.userService.addKnownKana(userId, newKana);
      }
    }

    // Full award once, practice award thereafter (OPEN-ITEMS #0). The upsert is
    // atomic, so two concurrent first completions produce timesCompleted 1 and 2
    // — exactly one of them can be the first, and only it gets the full award.
    const xpAwarded = firstCompletion ? XP_PER_LESSON_COMPLETION : this.xpPerPractice;

    const user = await this.userService.awardXp(userId, xpAwarded);

    // Deliberately last, and guarded here as well as inside AnalyticsService:
    // completion and XP are already committed by this point, so a failure to log
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
          xpAwarded,
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
      xpAwarded,
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
   * Gate #2: the learner must have finished some attempt of this lesson with
   * every question they were asked answered **correctly**.
   *
   * ## Why this got stricter
   *
   * It used to be "at least one exercise answered", which let a learner answer
   * everything wrong and still complete the lesson — reported from the live site
   * on 2026-07-26. Getting a question wrong means you did not know it, so
   * finishing on that basis is the app certifying something untrue, and the XP and
   * the "done" tick both lie.
   *
   * ## Why it is not "all correct first try"
   *
   * The clients re-ask a question the learner got wrong until they answer it
   * correctly, so completion requires persistence rather than first-try perfection.
   *
   * So the rule is "you finished having got everything right", reached by
   * persistence rather than by first-try perfection.
   */
  private async assertUserAnsweredEverythingCorrectly(
    userId: string,
    lessonId: string,
  ): Promise<void> {
    const clean = await this.exerciseAttempts.hasCleanAttemptForLesson(userId, lessonId);
    if (!clean) {
      const answered = await this.exerciseAttempts.countAttemptsForLesson(userId, lessonId);

      // Two different situations, and the copy should not conflate them: nothing
      // answered at all is a spoofed request, while answers outstanding is a
      // learner who has work left.
      throw new ConflictException(
        answered === 0
          ? 'Answer the exercises before completing this lesson.'
          : 'Answer every exercise correctly before completing this lesson.',
      );
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
   * The unit slugs the learner has *finished* — every lesson in the unit
   * has a row in `lessonCompletions`.
   *
   * "Finished" here means lesson-completion, matching the client's
   * `UnitGroup.status === 'done'` derivation. That is the same rule the home
   * screen applies, and what makes a combined-test entry point appear in
   * the right place at the right time.
   *
   * Two queries regardless of how many units the course grows to: one for
   * the completed set, one for the unit↔lesson map. Returns slugs in the
   * order they come out of the curriculum (`findLessons` already sorts by
   * `unit` then `order`), not alphabetical — which keeps the result screen
   * saying "Hiragana basics + Katakana basics" in the order a learner
   * actually did them.
   */
  async listFinishedUnitSlugs(userId: string): Promise<string[]> {
    const completed = new Set(await this.findCompletedLessonIds(userId));
    if (completed.size === 0) return [];

    const lessons = await this.contentService.findLessons();
    const byUnit = new Map<string, Set<string>>();
    for (const lesson of lessons) {
      let set = byUnit.get(lesson.unit);
      if (!set) {
        set = new Set();
        byUnit.set(lesson.unit, set);
      }
      set.add(lesson.id);
    }

    return [...byUnit.entries()]
      .filter(([, lessonIds]) => [...lessonIds].every((id) => completed.has(id)))
      .map(([unit]) => unit);
  }

  /**
   * Account-deletion cascade for OPEN-ITEMS #5/#32.
   *
   * Erases every piece of learning data owned by this module for the given user.
   * Called by `AccountDeletionService` as part of the `DELETE /me` cascade —
   * never by any other path.
   *
   * Parallel deletes rather than sequential: every collection is indexed on
   * `userId`, so each is an O(1) index seek, and none depends on the other.
   *
   * `learnerItemStates` and `unitCheckpointAttempts` go through their own
   * services rather than models this class injects — those collections have
   * owners, and the rule that a module never touches another's collections
   * applies within a module too.
   *
   * **A collection added to this module belongs here in the same commit.**
   * `learnerItemStates` spent two slices outside this list because it was
   * added after the cascade was written, and `DELETE /me` quietly stopped
   * being the complete erasure the contract promises (OPEN-ITEMS #38).
   */
  async deleteAllForUser(userId: string): Promise<void> {
    const objectId = new Types.ObjectId(userId);
    await Promise.all([
      // Dormant records created by the removed spaced-review subsystem are not
      // read by the application, but account deletion must still erase them.
      this.connection.collection('srsCards').deleteMany({ userId: objectId }),
      this.connection.collection('dailyStudySessions').deleteMany({ userId: objectId }),
      this.lessonCompletionModel.deleteMany({ userId: objectId }).exec(),
      this.exerciseAttempts.deleteAllForUser(userId),
      this.learnerItemStateService.deleteAllForUser(userId),
      this.checkpointAttempts.deleteAllForUser(userId),
    ]);
  }
}
