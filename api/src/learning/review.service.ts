import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import { BadRequestException } from '@nestjs/common';
import { FSRS, fsrs, generatorParameters } from 'ts-fsrs';
import { AnalyticsService } from '../analytics/analytics.service';
import { ContentService } from '../content/content.service';
import { UserDocument } from '../user/schemas/user.schema';
import { UserService } from '../user/user.service';
import {
  DueCard,
  DueReviewsResponse,
  GradeReviewResponse,
} from './dto/review.dto';
import { fromFsrsCard, gradeToRating, ReviewGrade, toFsrsCard } from './fsrs-card.mapper';
import { LearnerItemStateService } from './learner-item-state.service';
import { computeMastery, SrsCard, SrsCardDocument } from './schemas/srs-card.schema';

/** §6: cap a session so it's bounded. */
export const REVIEW_SESSION_CAP = 20;

/**
 * Flat award per graded review, regardless of grade — but only when the card
 * was actually due. Re-grading a card that isn't due still reschedules (ts-fsrs
 * handles it correctly) and awards nothing. OPEN-ITEMS #0b.
 */
export const XP_PER_REVIEW = 2;

/**
 * The review loop (§6). All scheduling math belongs to ts-fsrs — this class
 * loads a card, hands it to the library, and persists what comes back.
 */
@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);
  private readonly scheduler: FSRS;

  constructor(
    @InjectModel(SrsCard.name) private readonly srsCardModel: Model<SrsCardDocument>,
    private readonly contentService: ContentService,
    private readonly userService: UserService,
    private readonly analyticsService: AnalyticsService,
    // §5.2 / ADR-003: the learner-model write path. Same module as the SRS
    // card, no extra wiring. Every grade emits one `record()` call; the
    // service handles its own failure semantics (never throws) and we still
    // guard here so a contract change cannot undo a saved grade.
    private readonly learnerItemStateService: LearnerItemStateService,
  ) {
    // Default parameters: learning steps 1m -> 10m, relearning 10m.
    this.scheduler = fsrs(generatorParameters());
  }

  /**
   * §6: "fetch this user's due cards" is the only query that has to be fast.
   * `{ userId, due: { $lte: now } }` sorted by `due` is served end-to-end by
   * the { userId: 1, due: 1 } compound index — both the filter and the sort,
   * so there's no in-memory sort stage.
   */
  async findDue(userId: string): Promise<DueReviewsResponse> {
    const now = new Date();
    const filter = { userId: new Types.ObjectId(userId), due: { $lte: now } };

    const [cards, totalDue] = await Promise.all([
      this.srsCardModel.find(filter).sort({ due: 1 }).limit(REVIEW_SESSION_CAP).exec(),
      this.srsCardModel.countDocuments(filter).exec(),
    ]);

    // One batched resolve for the whole page rather than per card.
    const items = await this.contentService.resolveItemRefs(
      cards.map((card) => ({ kind: card.itemRef.kind, id: card.itemRef.id })),
    );
    const itemsById = new Map(items.map((item) => [item.id, item]));

    const due: DueCard[] = [];
    for (const card of cards) {
      const item = itemsById.get(card.itemRef.id.toString());
      if (!item) {
        // Content deleted out from under the card — skip rather than render a
        // blank review. The card stays put; nothing here mutates it.
        this.logger.warn(`Card ${card._id.toString()} references missing content, skipping`);
        continue;
      }

      const totalReviews = card.totalReviews ?? 0;
      const correctReviews = card.correctReviews ?? 0;
      const accuracyRate = totalReviews > 0 ? Number((correctReviews / totalReviews).toFixed(2)) : 0;

      due.push({
        cardId: card._id.toString(),
        state: card.state,
        mastery: computeMastery(card),
        due: card.due,
        reps: card.reps,
        lapses: card.lapses,
        totalReviews,
        accuracyRate,
        item,
      });
    }

    return { count: due.length, totalDue, cap: REVIEW_SESSION_CAP, cards: due };
  }

  /**
   * Just the number of cards due, for /me/progress. Separate from `findDue`
   * deliberately: that one resolves every card's content through the content
   * service to render a session, which is a lot of work to throw away when the
   * caller only wants a count. This is served entirely by the
   * { userId: 1, due: 1 } index — a covered count, no documents fetched.
   */
  async countDue(userId: string, now: Date = new Date()): Promise<number> {
    return this.srsCardModel
      .countDocuments({ userId: new Types.ObjectId(userId), due: { $lte: now } })
      .exec();
  }

  async grade(
    userId: string,
    cardId: string,
    grade: ReviewGrade,
    responseTimeMs?: number,
  ): Promise<GradeReviewResponse> {
    if (!isValidObjectId(cardId)) {
      throw new BadRequestException(`Malformed card id: ${cardId}`);
    }

    // Scoped to the user, so one learner can never grade another's card — and
    // a foreign id is indistinguishable from a missing one.
    const card = await this.srsCardModel
      .findOne({ _id: new Types.ObjectId(cardId), userId: new Types.ObjectId(userId) })
      .exec();

    if (!card) {
      throw new NotFoundException('Review card not found');
    }

    const now = new Date();

    // Read before the card is rescheduled — afterwards `due` is in the future by
    // construction, so this is the only moment the answer is available.
    const wasDue = card.due.getTime() <= now.getTime();

    // The whole of the scheduling decision, delegated. Nothing below this line
    // recomputes an interval.
    const { card: scheduled } = this.scheduler.next(
      toFsrsCard(card, now),
      now,
      gradeToRating(grade),
    );
    const fields = fromFsrsCard(scheduled);

    card.set(fields);
    card.totalReviews = (card.totalReviews ?? 0) + 1;
    if (grade === 'good' || grade === 'easy') {
      card.correctReviews = (card.correctReviews ?? 0) + 1;
    }
    await card.save();

    const xpAwarded = wasDue ? XP_PER_REVIEW : 0;

    // §5.2 / ADR-003: every grade — even a not-due re-grade — is evidence.
    // `wasDue` gates XP and the streak, not confidence. Re-grading an
    // already-graded card still tells us something about how the learner
    // handles this word; suppressing the record would lose that signal.
    // `correct` mirrors the same predicate `card.correctReviews` uses, so
    // the two stay in lockstep.
    this.learnerItemStateService
      .record({
        userId: new Types.ObjectId(userId),
        itemRef: { kind: card.itemRef.kind, id: card.itemRef.id },
        outcome: { correct: grade === 'good' || grade === 'easy', responseTimeMs },
        exerciseType: null,
        sourceContext: 'review',
      })
      .catch((err: unknown) => {
        this.logger.warn(
          `LearnerItemState record lost for card ${cardId}: ` +
            `${err instanceof Error ? err.message : String(err)}`,
        );
      });

    // Deliberately not `awardXp(userId, 0)` on the not-due path. awardXp is also
    // where the streak advances, so calling it would let a learner hold a streak
    // by re-grading the same card — a smaller version of the hole this closes.
    // No XP means no study credit, so we only read the user for `totalXp`.
    const user = wasDue
      ? await this.userService.awardXp(userId, xpAwarded)
      : await this.requireUser(userId);

    await this.analyticsService
      .record({
        userId,
        type: 'review.graded',
        payload: {
          cardId: card._id.toString(),
          itemKind: card.itemRef.kind,
          itemId: card.itemRef.id.toString(),
          grade,
          state: fields.state,
          due: fields.due.toISOString(),
          reps: fields.reps,
          lapses: fields.lapses,
          xpAwarded,
          wasDue,
          responseTimeMs: responseTimeMs ?? null,
        },
      })
      .catch((err: unknown) => {
        // The grade is already persisted; losing the event must not undo it.
        this.logger.warn(
          `review.graded event lost for card ${cardId}: ` +
            `${err instanceof Error ? err.message : String(err)}`,
        );
      });

    const totalReviews = card.totalReviews;
    const correctReviews = card.correctReviews;
    const accuracyRate = totalReviews > 0 ? Number((correctReviews / totalReviews).toFixed(2)) : 0;

    return {
      cardId: card._id.toString(),
      grade,
      state: fields.state,
      mastery: computeMastery(card),
      due: fields.due,
      intervalMinutes: Math.round((fields.due.getTime() - now.getTime()) / 60_000),
      reps: fields.reps,
      lapses: fields.lapses,
      totalReviews,
      accuracyRate,
      xpAwarded,
      totalXp: user.gamification.xp,
    };
  }

  /**
   * The not-due path still has to report `totalXp`, and gets it without going
   * through awardXp. UserService owns `users`; this only reads through it (§4).
   */
  private async requireUser(userId: string): Promise<UserDocument> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
