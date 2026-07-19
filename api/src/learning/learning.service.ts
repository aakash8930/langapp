import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AnalyticsService } from '../analytics/analytics.service';
import { ContentService } from '../content/content.service';
import { ResolvedItem } from '../content/dto/lesson-response.dto';
import { UserService } from '../user/user.service';
import { CompleteLessonResponse } from './dto/complete-lesson-response.dto';
import { newCardFields } from './fsrs-card.mapper';
import { LessonCompletion, LessonCompletionDocument } from './schemas/lesson-completion.schema';
import { SrsCard, SrsCardDocument } from './schemas/srs-card.schema';

/** Flat award per completion. See OPEN-ITEMS — repeat completions re-award. */
export const XP_PER_LESSON_COMPLETION = 10;

/** Mongo duplicate-key error. */
const DUPLICATE_KEY = 11000;

/**
 * Owns `srsCards`. Reaches content, users and analytics only through their
 * exported services — never their collections (§4).
 */
@Injectable()
export class LearningService {
  private readonly logger = new Logger(LearningService.name);

  constructor(
    @InjectModel(SrsCard.name) private readonly srsCardModel: Model<SrsCardDocument>,
    @InjectModel(LessonCompletion.name)
    private readonly lessonCompletionModel: Model<LessonCompletionDocument>,
    private readonly contentService: ContentService,
    private readonly userService: UserService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async completeLesson(userId: string, lessonId: string): Promise<CompleteLessonResponse> {
    // Reuses the validated read path — 400 on a malformed id, 404 if absent.
    // `items` excludes refs whose content is gone, so no card is created for
    // an item the learner could never actually review.
    const lesson = await this.contentService.findLessonById(lessonId);

    const created = await this.seedCards(userId, lesson.items);

    await this.recordCompletion(userId, lesson.id);

    const user = await this.userService.awardXp(userId, XP_PER_LESSON_COMPLETION);

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
          xpAwarded: XP_PER_LESSON_COMPLETION,
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
      xpAwarded: XP_PER_LESSON_COMPLETION,
      totalXp: user.gamification.xp,
    };
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
   */
  private async recordCompletion(userId: string, lessonId: string): Promise<void> {
    const now = new Date();

    await this.lessonCompletionModel
      .updateOne(
        { userId: new Types.ObjectId(userId), lessonId: new Types.ObjectId(lessonId) },
        {
          $inc: { timesCompleted: 1 },
          $set: { lastCompletedAt: now },
          $setOnInsert: { firstCompletedAt: now },
        },
        { upsert: true },
      )
      .exec();
  }

  /** Distinct lessons this user has completed at least once. */
  async countCompletedLessons(userId: string): Promise<number> {
    return this.lessonCompletionModel
      .countDocuments({ userId: new Types.ObjectId(userId) })
      .exec();
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
