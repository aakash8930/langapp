import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import { BadRequestException } from '@nestjs/common';
import { FSRS, fsrs, generatorParameters } from 'ts-fsrs';
import { AnalyticsService } from '../analytics/analytics.service';
import { ContentService } from '../content/content.service';
import { UserService } from '../user/user.service';
import {
  DueCard,
  DueReviewsResponse,
  GradeReviewResponse,
} from './dto/review.dto';
import { fromFsrsCard, gradeToRating, ReviewGrade, toFsrsCard } from './fsrs-card.mapper';
import { SrsCard, SrsCardDocument } from './schemas/srs-card.schema';

/** §6: cap a session so it's bounded. */
export const REVIEW_SESSION_CAP = 20;

/** Flat award per graded review, regardless of grade. */
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

      due.push({
        cardId: card._id.toString(),
        state: card.state,
        due: card.due,
        reps: card.reps,
        lapses: card.lapses,
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

    // The whole of the scheduling decision, delegated. Nothing below this line
    // recomputes an interval.
    const { card: scheduled } = this.scheduler.next(
      toFsrsCard(card, now),
      now,
      gradeToRating(grade),
    );
    const fields = fromFsrsCard(scheduled);

    card.set(fields);
    await card.save();

    const user = await this.userService.awardXp(userId, XP_PER_REVIEW);

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
          xpAwarded: XP_PER_REVIEW,
        },
      })
      .catch((err: unknown) => {
        // The grade is already persisted; losing the event must not undo it.
        this.logger.warn(
          `review.graded event lost for card ${cardId}: ` +
            `${err instanceof Error ? err.message : String(err)}`,
        );
      });

    return {
      cardId: card._id.toString(),
      grade,
      state: fields.state,
      due: fields.due,
      intervalMinutes: Math.round((fields.due.getTime() - now.getTime()) / 60_000),
      reps: fields.reps,
      lapses: fields.lapses,
      stability: fields.stability,
      difficulty: fields.difficulty,
      xpAwarded: XP_PER_REVIEW,
      totalXp: user.gamification.xp,
    };
  }
}
