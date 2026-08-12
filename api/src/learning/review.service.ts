import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import { BadRequestException } from '@nestjs/common';
import { FSRS, fsrs, generatorParameters } from 'ts-fsrs';
import { AnalyticsService, ReviewAnalyticsEvent } from '../analytics/analytics.service';
import { ContentService } from '../content/content.service';
import { CONTENT_KINDS, ContentKind } from '../knowledge-graph/schemas/knowledge-node.schema';
import { UserDocument } from '../user/schemas/user.schema';
import { UserService } from '../user/user.service';
import { localDateString } from '../user/gamification/streak';
import {
  DailyForecastEntry,
  DailyStudySessionResponse,
  DueCard,
  DueReviewsResponse,
  GradeReviewResponse,
  MissedReviewsResponse,
  ReviewEventResponse,
  ReviewRetentionResponse,
  ReviewStatisticsResponse,
  ReviewSummaryResponse,
} from './dto/review.dto';
import { fromFsrsCard, gradeToRating, REVIEW_GRADES, ReviewGrade, toFsrsCard } from './fsrs-card.mapper';
import { LearnerItemStateService } from './learner-item-state.service';
import {
  computeMastery,
  RECENT_REVIEW_WINDOW,
  SrsCard,
  SrsCardDocument,
} from './schemas/srs-card.schema';
import {
  DailyStudySession,
  DailyStudySessionDocument,
} from './schemas/daily-study-session.schema';

/** §6: cap a session so it's bounded. */
export const REVIEW_SESSION_CAP = 20;

/**
 * Flat award per graded review, regardless of grade — but only when the card
 * was actually due. Re-grading a card that isn't due still reschedules (ts-fsrs
 * handles it correctly) and awards nothing. OPEN-ITEMS #0b.
 */
export const XP_PER_REVIEW = 2;
export const DAILY_NEW_CARD_CAP = 5;

function payloadString(event: ReviewAnalyticsEvent, key: string): string | null {
  const value = event.payload[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function payloadNumber(event: ReviewAnalyticsEvent, key: string): number | null {
  const value = event.payload[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function payloadBoolean(event: ReviewAnalyticsEvent, key: string): boolean | null {
  const value = event.payload[key];
  return typeof value === 'boolean' ? value : null;
}

function payloadDate(event: ReviewAnalyticsEvent, key: string): Date | null {
  const value = payloadString(event, key);
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function payloadGrade(event: ReviewAnalyticsEvent): ReviewGrade | null {
  const value = payloadString(event, 'grade');
  return REVIEW_GRADES.includes(value as ReviewGrade) ? value as ReviewGrade : null;
}

function isContentKind(value: string | null): value is ContentKind {
  return value !== null && CONTENT_KINDS.includes(value as ContentKind);
}

function localDateRange(endDate: string, days: number): string[] {
  const [year, month, day] = endDate.split('-').map(Number);
  const cursor = new Date(Date.UTC(year, month - 1, day));
  cursor.setUTCDate(cursor.getUTCDate() - (days - 1));
  return Array.from({ length: days }, () => {
    const value = cursor.toISOString().slice(0, 10);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    return value;
  });
}

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
    @InjectModel(DailyStudySession.name)
    private readonly dailySessionModel?: Model<DailyStudySessionDocument>,
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
   * Generate today's stable study set once: due review cards take priority,
   * then up to five genuinely new cards fill the remaining space. The selected
   * ids are persisted, so returning later today never changes the queue.
   */
  async findDailySession(userId: string): Promise<DailyStudySessionResponse> {
    if (!this.dailySessionModel) {
      throw new Error('Daily study sessions are not configured');
    }
    const user = await this.requireUser(userId);
    const now = new Date();
    const localDate = localDateString(now, user.settings.tz);
    const existing = await this.dailySessionModel
      .findOne({ userId: new Types.ObjectId(userId), localDate })
      .exec();

    if (existing) {
      const cards = await this.srsCardModel.find({ _id: { $in: existing.cardIds } }).exec();
      return this.toDailySessionResponse(cards, existing, localDate);
    }

    const userObjectId = new Types.ObjectId(userId);
    const due = await this.srsCardModel
      .find({ userId: userObjectId, due: { $lte: now }, state: { $ne: 'new' } })
      .sort({ due: 1 })
      .limit(REVIEW_SESSION_CAP)
      .exec();
    const remaining = Math.max(0, REVIEW_SESSION_CAP - due.length);
    const newCards = remaining === 0
      ? []
      : await this.srsCardModel
          .find({ userId: userObjectId, due: { $lte: now }, state: 'new' })
          .sort({ createdAt: 1, _id: 1 })
          .limit(Math.min(remaining, DAILY_NEW_CARD_CAP))
          .exec();
    const cardIds = [...due, ...newCards].map((card) => card._id);

    let session: DailyStudySessionDocument;
    try {
      session = await this.dailySessionModel.create({
        userId: userObjectId,
        localDate,
        cardIds,
        dueCount: due.length,
        newCount: newCards.length,
      });
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
        const winner = await this.dailySessionModel
          .findOne({ userId: userObjectId, localDate })
          .exec();
        if (winner) {
          const cards = await this.srsCardModel.find({ _id: { $in: winner.cardIds } }).exec();
          return this.toDailySessionResponse(cards, winner, localDate);
        }
      }
      throw err;
    }
    return this.toDailySessionResponse([...due, ...newCards], session, localDate);
  }

  private async toDailySessionResponse(
    cards: SrsCardDocument[],
    session: DailyStudySessionDocument,
    localDate: string,
  ): Promise<DailyStudySessionResponse> {
    const byId = new Map(cards.map((card) => [card._id.toString(), card]));
    const now = new Date();
    const ordered = session.cardIds
      .map((id) => byId.get(id.toString()))
      .filter((card): card is SrsCardDocument => card !== undefined)
      // A persisted daily session is a stable selection, not permission to
      // repeat cards already rescheduled into the future. Learning-step cards
      // naturally re-enter once their server due time arrives again.
      .filter((card) => card.due.getTime() <= now.getTime());
    const items = await this.contentService.resolveItemRefs(
      ordered.map((card) => ({ kind: card.itemRef.kind, id: card.itemRef.id })),
    );
    const itemsById = new Map(items.map((item) => [item.id, item]));
    const due = ordered.flatMap((card) => {
      const item = itemsById.get(card.itemRef.id.toString());
      if (!item) return [];
      const totalReviews = card.totalReviews ?? 0;
      const correctReviews = card.correctReviews ?? 0;
      return [{
        cardId: card._id.toString(),
        state: card.state,
        mastery: computeMastery(card),
        due: card.due,
        reps: card.reps,
        lapses: card.lapses,
        totalReviews,
        accuracyRate: totalReviews === 0 ? 0 : Number((correctReviews / totalReviews).toFixed(2)),
        item,
      }];
    });
    const newCount = ordered.filter((card) => card.state === 'new').length;
    const dueCount = ordered.length - newCount;
    return {
      localDate,
      dueCount,
      newCount,
      count: due.length,
      totalDue: due.length,
      cap: REVIEW_SESSION_CAP,
      cards: due,
    };
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
    const previousState = card.state;
    const previousDue = card.due;

    // The whole of the scheduling decision, delegated. Nothing below this line
    // recomputes an interval.
    const { card: scheduled } = this.scheduler.next(
      toFsrsCard(card, now),
      now,
      gradeToRating(grade),
    );
    const fields = fromFsrsCard(scheduled);
    const intervalMinutes = Math.round((fields.due.getTime() - now.getTime()) / 60_000);

    card.set(fields);
    card.totalReviews = (card.totalReviews ?? 0) + 1;
    const recalled = grade === 'good' || grade === 'easy';
    if (recalled) {
      card.correctReviews = (card.correctReviews ?? 0) + 1;
    }
    card.recentReviewOutcomes = [
      ...(card.recentReviewOutcomes ?? []),
      recalled,
    ].slice(-RECENT_REVIEW_WINDOW);
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
          previousState,
          state: fields.state,
          previousDue: previousDue.toISOString(),
          due: fields.due.toISOString(),
          intervalMinutes,
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
      intervalMinutes,
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

  /** Queue counts without resolving content. All four state counts are subsets of dueNow. */
  async getSummary(userId: string): Promise<ReviewSummaryResponse> {
    const user = await this.requireUser(userId);
    const now = new Date();
    const localDate = localDateString(now, user.settings.tz);
    const [dueCards, totalCards, recentEvents] = await Promise.all([
      this.srsCardModel
        .find({ userId: new Types.ObjectId(userId), due: { $lte: now } })
        .select('due state')
        .exec(),
      this.srsCardModel.countDocuments({ userId: new Types.ObjectId(userId) }).exec(),
      this.analyticsService.listReviewEvents(userId, { limit: 100 }),
    ]);
    const states = { new: 0, learning: 0, review: 0, relearning: 0 };
    for (const card of dueCards) {
      if (card.state in states) states[card.state as keyof typeof states] += 1;
    }
    const overdue = dueCards.filter(
      (card) => localDateString(card.due, user.settings.tz) < localDate,
    ).length;
    const timings = recentEvents
      .map((event) => payloadNumber(event, 'responseTimeMs'))
      .filter((value): value is number => value !== null && value > 0);
    const averageMs = timings.length > 0
      ? timings.reduce((sum, value) => sum + value, 0) / timings.length
      : null;
    return {
      localDate,
      dueNow: dueCards.length,
      overdue,
      states,
      totalCards,
      estimatedMinutes: averageMs === null || dueCards.length === 0
        ? null
        : Math.max(1, Math.ceil((averageMs * dueCards.length) / 60_000)),
      timingSamples: timings.length,
    };
  }

  /** Exact per-day review totals from persisted review.graded events. */
  async getHistory(userId: string, days: number): Promise<{ date: string; count: number; recalled: number }[]> {
    const user = await this.requireUser(userId);
    const now = new Date();
    const dates = localDateRange(localDateString(now, user.settings.tz), days);
    const byDate = new Map(dates.map((date) => [date, { count: 0, recalled: 0 }]));
    const since = new Date(now.getTime() - (days + 2) * 24 * 60 * 60 * 1000);
    const events = await this.analyticsService.listReviewEvents(userId, { since, newestFirst: false });
    for (const event of events) {
      const date = localDateString(event.ts, user.settings.tz);
      const bucket = byDate.get(date);
      if (!bucket) continue;
      bucket.count += 1;
      const grade = payloadGrade(event);
      if (grade === 'good' || grade === 'easy') bucket.recalled += 1;
    }
    return dates.map((date) => ({ date, ...byDate.get(date)! }));
  }

  /** Same underlying review events as history, shaped for a contribution graph. */
  async getHeatmap(userId: string, days: number): Promise<{ date: string; count: number }[]> {
    const history = await this.getHistory(userId, days);
    return history.map(({ date, count }) => ({ date, count }));
  }

  async getEvents(userId: string, limit: number): Promise<ReviewEventResponse[]> {
    const events = await this.analyticsService.listReviewEvents(userId, { limit });
    const refs = events.flatMap((event) => {
      const kind = payloadString(event, 'itemKind');
      const id = payloadString(event, 'itemId');
      return isContentKind(kind) && id && isValidObjectId(id)
        ? [{ kind, id: new Types.ObjectId(id) }]
        : [];
    });
    const items = await this.contentService.resolveItemRefs(refs);
    const itemsById = new Map(items.map((item) => [item.id, item]));
    return events.map((event) => {
      const itemId = payloadString(event, 'itemId');
      return {
        id: event.id,
        reviewedAt: event.ts,
        cardId: payloadString(event, 'cardId'),
        grade: payloadGrade(event),
        itemKind: payloadString(event, 'itemKind'),
        itemId,
        item: itemId ? itemsById.get(itemId) ?? null : null,
        previousState: payloadString(event, 'previousState'),
        newState: payloadString(event, 'state'),
        previousDue: payloadDate(event, 'previousDue'),
        newDue: payloadDate(event, 'due'),
        intervalMinutes: payloadNumber(event, 'intervalMinutes'),
        responseTimeMs: payloadNumber(event, 'responseTimeMs'),
        wasDue: payloadBoolean(event, 'wasDue'),
      };
    });
  }

  async getMissed(userId: string): Promise<MissedReviewsResponse> {
    const user = await this.requireUser(userId);
    const now = new Date();
    const localDate = localDateString(now, user.settings.tz);
    const dates = localDateRange(localDate, 7);
    const dueCards = await this.srsCardModel
      .find({ userId: new Types.ObjectId(userId), due: { $lte: now } })
      .sort({ due: 1 })
      .exec();
    const overdue = dueCards.filter(
      (card) => localDateString(card.due, user.settings.tz) < localDate,
    );
    const selected = overdue.slice(0, REVIEW_SESSION_CAP);
    const items = await this.contentService.resolveItemRefs(
      selected.map((card) => ({ kind: card.itemRef.kind, id: card.itemRef.id })),
    );
    const itemsById = new Map(items.map((item) => [item.id, item]));
    const overdueCards = selected.flatMap((card) => {
      const item = itemsById.get(card.itemRef.id.toString());
      if (!item) return [];
      const totalReviews = card.totalReviews ?? 0;
      const correctReviews = card.correctReviews ?? 0;
      return [{
        cardId: card._id.toString(),
        state: card.state,
        mastery: computeMastery(card),
        due: card.due,
        reps: card.reps,
        lapses: card.lapses,
        totalReviews,
        accuracyRate: totalReviews > 0 ? Number((correctReviews / totalReviews).toFixed(2)) : 0,
        item,
      }];
    });
    const since = new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000);
    const events = await this.analyticsService.listReviewEvents(userId, { since });
    const failures = events.filter((event) => payloadGrade(event) === 'again');
    return {
      localDate,
      overdueNow: overdue.length,
      failedToday: failures.filter(
        (event) => localDateString(event.ts, user.settings.tz) === localDate,
      ).length,
      failedLast7Days: failures.filter(
        (event) => dates.includes(localDateString(event.ts, user.settings.tz)),
      ).length,
      overdueCards,
      cap: REVIEW_SESSION_CAP,
    };
  }

  async getStatistics(userId: string, days: number): Promise<ReviewStatisticsResponse> {
    const user = await this.requireUser(userId);
    const now = new Date();
    const dates = localDateRange(localDateString(now, user.settings.tz), days);
    const since = new Date(now.getTime() - (days + 2) * 24 * 60 * 60 * 1000);
    const [eventsInWindow, summary, cards] = await Promise.all([
      this.analyticsService.listReviewEvents(userId, { since }),
      this.getSummary(userId),
      this.srsCardModel.find({ userId: new Types.ObjectId(userId) }).exec(),
    ]);
    const events = eventsInWindow.filter(
      (event) => dates.includes(localDateString(event.ts, user.settings.tz)),
    );
    const grades: Record<ReviewGrade, number> = { again: 0, hard: 0, good: 0, easy: 0 };
    for (const event of events) {
      const grade = payloadGrade(event);
      if (grade) grades[grade] += 1;
    }
    const timings = events
      .map((event) => payloadNumber(event, 'responseTimeMs'))
      .filter((value): value is number => value !== null && value > 0);
    const states = { new: 0, learning: 0, review: 0, relearning: 0 };
    const mastery = { new: 0, learning: 0, familiar: 0, mastered: 0 };
    for (const card of cards) {
      states[card.state] += 1;
      mastery[computeMastery(card)] += 1;
    }
    const successfulReviews = grades.good + grades.easy;
    return {
      days,
      reviewsCompleted: events.length,
      successfulReviews,
      observedSuccessRate: events.length > 0
        ? Number((successfulReviews / events.length).toFixed(3))
        : null,
      averageResponseTimeMs: timings.length > 0
        ? Math.round(timings.reduce((sum, value) => sum + value, 0) / timings.length)
        : null,
      timingSamples: timings.length,
      grades,
      dueNow: summary.dueNow,
      overdueNow: summary.overdue,
      totalCards: cards.length,
      states,
      mastery,
    };
  }

  async getRetention(userId: string, observedDays: number): Promise<ReviewRetentionResponse> {
    const now = new Date();
    const cards = await this.srsCardModel.find({ userId: new Types.ObjectId(userId) }).exec();
    const reviewed = cards.filter((card) => card.reps > 0 && card.lastReview !== null);
    const retentionFor = (card: SrsCardDocument) => {
      const elapsedDays = Math.max(0, (now.getTime() - card.lastReview!.getTime()) / 86_400_000);
      return Math.exp(-elapsedDays / Math.max(0.1, card.stability));
    };
    const byKindMap = new Map<string, { cards: number; total: number }>();
    for (const card of reviewed) {
      const row = byKindMap.get(card.itemRef.kind) ?? { cards: 0, total: 0 };
      row.cards += 1;
      row.total += retentionFor(card);
      byKindMap.set(card.itemRef.kind, row);
    }
    const user = await this.requireUser(userId);
    const dates = localDateRange(localDateString(now, user.settings.tz), observedDays);
    const since = new Date(now.getTime() - (observedDays + 2) * 86_400_000);
    const eventRows = await this.analyticsService.listReviewEvents(userId, { since });
    const events = eventRows.filter(
      (event) => dates.includes(localDateString(event.ts, user.settings.tz)),
    );
    const successful = events.filter((event) => {
      const grade = payloadGrade(event);
      return grade === 'good' || grade === 'easy';
    }).length;
    return {
      totalCards: cards.length,
      reviewedCards: reviewed.length,
      predictedRetentionRate: reviewed.length > 0
        ? Number((reviewed.reduce((sum, card) => sum + retentionFor(card), 0) / reviewed.length * 100).toFixed(1))
        : null,
      byKind: [...byKindMap.entries()].map(([kind, row]) => ({
        kind,
        cards: row.cards,
        predictedRetentionRate: Number((row.total / row.cards * 100).toFixed(1)),
      })),
      observedDays,
      observedReviews: events.length,
      observedSuccessRate: events.length > 0 ? Number((successful / events.length).toFixed(3)) : null,
    };
  }

  async getDailyForecast(userId: string, days: number): Promise<DailyForecastEntry[]> {
    const user = await this.requireUser(userId);
    const today = localDateString(new Date(), user.settings.tz);
    const dates = localDateRange(today, days);
    const counts = new Map(dates.map((date) => [date, 0]));
    const cards = await this.srsCardModel
      .find({ userId: new Types.ObjectId(userId) })
      .select('due')
      .exec();
    for (const card of cards) {
      const dueDate = localDateString(card.due, user.settings.tz);
      const bucket = dueDate < today ? today : dueDate;
      if (counts.has(bucket)) counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    }
    return dates.map((date) => ({ date, due: counts.get(date) ?? 0, isToday: date === today }));
  }

  async getForecast(userId: string): Promise<{ days: number; due: number; weekLabel: string }[]> {
    const now = new Date();
    const cards = await this.srsCardModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ due: 1 })
      .lean()
      .exec();

    const forecast: { days: number; due: number; weekLabel: string }[] = [];
    for (let w = 0; w < 4; w++) {
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() + (w + 1) * 7);
      const due = cards.filter((c) => c.due <= weekEnd).length;
      forecast.push({ days: (w + 1) * 7, due, weekLabel: `W${w + 1}` });
    }
    return forecast;
  }
}
