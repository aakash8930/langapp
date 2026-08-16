import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AnalyticsService } from '../analytics/analytics.service';
import { ContentService } from '../content/content.service';
import { ResolvedItem } from '../content/dto/lesson-response.dto';
import { UserService } from '../user/user.service';
import { CompleteLessonResponse } from './dto/complete-lesson-response.dto';
import { CheckpointAttemptsService } from './checkpoint-attempts.service';
import { ExerciseAttemptsService } from './exercise-attempts.service';
import { newCardFields } from './fsrs-card.mapper';
import { LearnerItemStateService } from './learner-item-state.service';
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
    await this.assertUserAnsweredEverythingCorrectly(userId, lesson.id);

    const created = await this.seedCards(userId, lesson.items);

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
    // a lesson teaching *no* kana (e.g. vocab-only checkpoint reviews) free.
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
   * correctly, so a mistake costs a heart and a repeat rather than the lesson.
   * That matters more here than it looks: **`/complete` is what seeds the SRS
   * cards.** Hard-blocking completion would mean a word the learner got wrong
   * never enters review at all, which is precisely backwards — that is the word
   * they most need scheduled, and it is what T1.5 exists to arrange.
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

      // §5.2 / ADR-003: a correction is also evidence. Every matched vocab
      // gets one exposure with `correct: false` — the learner *was* corrected,
      // and that is the only honest signal the schema can carry.
      //
      // Fire-and-forget (`record` never throws internally; we attach an extra
      // `.catch` here so an interface contract change cannot turn a lost
      // evidence row into a lost chat turn). Uses `sourceContext: 'chat'`,
      // which lets a future weakness report distinguish "weak in conversation"
      // from "weak in a quiz".
      //
      // `correct: false` is deliberate: §5.2 names a chat correction as the
      // signal hearts used to collect, and a tutor correction is *evidence of
      // an error*, not evidence of mastery. Counter-intuitive on its face,
      // right on the second look.
      for (const doc of matched) {
        this.learnerItemStateService
          .record({
            userId: userObjectId,
            itemRef: { kind: 'vocab', id: doc._id },
            outcome: { correct: false },
            exerciseType: null,
            sourceContext: 'chat',
          })
          .catch((err: unknown) => {
            this.logger.warn(
              `LearnerItemState chat record lost for vocab ${doc._id.toString()}: ` +
                `${err instanceof Error ? err.message : String(err)}`,
            );
          });
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

  /**
   * §26 exercise-answer path: pull the SRS card for a specific item due when a
   * learner gets it wrong in an exercise.
   *
   * Identical guarantee to `scheduleMissedWords`, but without the text-matching
   * step — exercise answers already carry the exact item id, so there is nothing
   * to infer. Both branches follow the same "only move `due`, never the FSRS
   * model" rule:
   *
   * - **No card yet** → create one due now. The lesson should have seeded one on
   *   completion, but this is the correct fallback if for any reason it is absent.
   * - **Card exists** → pull `due` to now if it is in the future; leave an
   *   already-due card alone (a no-op write, and the card is already coming up).
   *
   * Never throws — a wrong answer has already been recorded by
   * `ExerciseAttemptsService`; failing over a scheduling side-effect would cost
   * the learner their answer feedback rather than the scheduling nicety.
   */
  async scheduleItemDue(
    userId: string,
    itemId: string,
    kind: string,
  ): Promise<{ cardCreated: boolean; cardAdvanced: boolean }> {
    try {
      const userObjectId = new Types.ObjectId(userId);
      const itemObjectId = new Types.ObjectId(itemId);
      const now = new Date();

      const existing = await this.srsCardModel
        .findOne({
          userId: userObjectId,
          'itemRef.kind': kind,
          'itemRef.id': itemObjectId,
        })
        .select('due')
        .exec();

      if (!existing) {
        await this.srsCardModel.create({
          userId: userObjectId,
          itemRef: { kind, id: itemObjectId },
          ...newCardFields(now),
        });
        return { cardCreated: true, cardAdvanced: false };
      }

      if (existing.due > now) {
        await this.srsCardModel
          .updateOne({ _id: existing._id }, { $set: { due: now } })
          .exec();
        return { cardCreated: false, cardAdvanced: true };
      }

      // Already due — nothing to do.
      return { cardCreated: false, cardAdvanced: false };
    } catch (err) {
      this.logger.warn(
        `Could not schedule item ${itemId} (${kind}) due for user ${userId}: ${
          err instanceof Error ? err.message : 'unknown error'
        }`,
      );
      return { cardCreated: false, cardAdvanced: false };
    }
  }

  async countCards(userId: string): Promise<number> {
    return this.srsCardModel.countDocuments({ userId: new Types.ObjectId(userId) }).exec();
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
      this.srsCardModel.deleteMany({ userId: objectId }).exec(),
      this.lessonCompletionModel.deleteMany({ userId: objectId }).exec(),
      this.exerciseAttempts.deleteAllForUser(userId),
      this.learnerItemStateService.deleteAllForUser(userId),
      this.checkpointAttempts.deleteAllForUser(userId),
    ]);
  }
}

function isDuplicateKeyError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const code = (err as { code?: number }).code;
  // insertMany with ordered:false reports a BulkWriteError wrapping per-doc codes.
  const writeErrors = (err as { writeErrors?: { err?: { code?: number } }[] }).writeErrors;
  return code === DUPLICATE_KEY || !!writeErrors?.some((e) => e.err?.code === DUPLICATE_KEY);
}
