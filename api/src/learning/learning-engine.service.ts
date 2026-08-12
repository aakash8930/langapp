import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AnalyticsService } from '../analytics/analytics.service';
import { ContentService } from '../content/content.service';
import { UserService } from '../user/user.service';
import { localDateString } from '../user/gamification/streak';
import { computeMastery, MasteryLevel, SrsCard, SrsCardDocument } from './schemas/srs-card.schema';

export interface ReadinessResponse {
  lessonId: string;
  readinessScore: number; // 0.0 to 1.0
  status: 'ready' | 'locked' | 'needs_review';
  masteredPrerequisites: number;
  totalPrerequisites: number;
  unmasteredPrerequisites: string[];
}

export interface RetentionCurvePoint {
  day: number;
  retentionRate: number; // Percentage 0 to 100
}

export interface MemoryModelResponse {
  totalCards: number;
  overallRetentionRate: number; // Percentage 0 to 100
  masteryBreakdown: Record<MasteryLevel, number>;
  forgettingCurve: RetentionCurvePoint[];
}

export interface ReviewAnalyticsResponse {
  totalReviewsToday: number;
  accuracyRateToday: number; // 0.0 to 1.0
  averageResponseTimeMs: number;
  masteredCount: number;
}

@Injectable()
export class LearningEngineService {
  constructor(
    @InjectModel(SrsCard.name) private readonly srsCardModel: Model<SrsCardDocument>,
    private readonly contentService: ContentService,
    private readonly analyticsService: AnalyticsService,
    private readonly userService: UserService,
  ) {}

  /**
   * Calculates the learner's readiness score (0.0 to 1.0) for a given lesson
   * by evaluating how many prerequisite items/lessons have been mastered.
   *
   * ## Why this does not read the knowledge graph (ADR-005)
   *
   * It used to look up the lesson's graph node and call `findPrerequisites` — and
   * then **discard the result**, so every request paid two extra queries for
   * nothing. Removed rather than wired up, deliberately.
   *
   * Reading prerequisites from the graph would make this answer depend on the
   * graph being complete, and a *missing* node yields zero prerequisites, which
   * scores 1.0 and reports `ready` for a lesson whose prerequisites are unmet.
   * That is a falsely-optimistic answer produced by absent data — the failure the
   * age gate avoids by treating unknown age as a refusal. The graph also holds no
   * lesson-level dependency that `prerequisiteLessonIds` does not, because it is
   * *derived* from that field; until it carries concept-level prerequisites
   * (OPEN-ITEMS #9a) reading it here would be indirection with a downside and no
   * upside.
   */
  async getReadiness(userId: string, lessonId: string): Promise<ReadinessResponse> {
    const lesson = await this.contentService.findLessonById(lessonId);
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    const prereqLessonIds = lesson.prerequisiteLessonIds || [];
    if (prereqLessonIds.length === 0) {
      return {
        lessonId,
        readinessScore: 1.0,
        status: 'ready',
        masteredPrerequisites: 0,
        totalPrerequisites: 0,
        unmasteredPrerequisites: [],
      };
    }

    // Check user's SRS cards for items in prerequisite lessons
    const prereqLessons = await Promise.all(
      prereqLessonIds.map((id) => this.contentService.findLessonById(id.toString())),
    );

    // Every prerequisite item, flattened, in the order the lessons list them —
    // which is the order `unmasteredPrerequisites` comes back in, so it stays
    // stable for a client rendering the list.
    const prereqItems = prereqLessons.flatMap((prereqLesson) => prereqLesson?.items ?? []);

    /**
     * One query for every card instead of one per item. A lesson with two
     * prerequisite lessons of thirty items each was thirty *sequential* round
     * trips per readiness request, awaited inside a nested loop; the unit already
     * has lessons that size, and readiness is a screen-load call.
     */
    const cards = await this.srsCardModel
      .find({
        userId: new Types.ObjectId(userId),
        'itemRef.id': { $in: prereqItems.map((item) => new Types.ObjectId(item.id)) },
      })
      .exec();

    const masteryByItemId = new Map<string, MasteryLevel>(
      cards.map((card) => [card.itemRef.id.toString(), computeMastery(card)]),
    );

    const unmastered: string[] = [];
    let masteredCount = 0;
    const totalPrereqs = prereqItems.length;

    for (const item of prereqItems) {
      const mastery = masteryByItemId.get(item.id);
      if (mastery === 'familiar' || mastery === 'mastered') {
        masteredCount++;
      } else {
        // No card at all counts as unmastered, same as before: a learner who has
        // never seen an item has not retained it.
        const itemLabel =
          'kana' in item
            ? item.kana
            : 'lemma' in item
              ? item.lemma
              : 'char' in item
                ? item.char
                : item.title;
        unmastered.push(itemLabel);
      }
    }

    const readinessScore = totalPrereqs > 0 ? Number((masteredCount / totalPrereqs).toFixed(2)) : 1.0;
    const status =
      readinessScore >= 0.8 ? 'ready' : readinessScore >= 0.5 ? 'needs_review' : 'locked';

    return {
      lessonId,
      readinessScore,
      status,
      masteredPrerequisites: masteredCount,
      totalPrerequisites: totalPrereqs,
      unmasteredPrerequisites: unmastered,
    };
  }

  /**
   * Computes the learner's overall memory model:
   * - Estimated retention rate R = e^(-t / S) across all SRS cards
   * - Mastery level breakdown
   * - 30-day predicted forgetting curve
   */
  async getMemoryModel(userId: string): Promise<MemoryModelResponse> {
    const userObjectId = new Types.ObjectId(userId);
    const cards = await this.srsCardModel.find({ userId: userObjectId }).exec();

    const breakdown: Record<MasteryLevel, number> = {
      new: 0,
      learning: 0,
      familiar: 0,
      mastered: 0,
    };

    if (cards.length === 0) {
      return {
        totalCards: 0,
        overallRetentionRate: 100,
        masteryBreakdown: breakdown,
        forgettingCurve: Array.from({ length: 30 }, (_, i) => ({ day: i + 1, retentionRate: 100 })),
      };
    }

    const now = new Date();
    let totalRetentionSum = 0;

    for (const card of cards) {
      const mastery = computeMastery(card);
      breakdown[mastery]++;

      // Calculate current retention R = e^(-t / S)
      const stabilityDays = Math.max(0.1, card.stability);
      const elapsedDays = card.lastReview
        ? Math.max(0, (now.getTime() - card.lastReview.getTime()) / (24 * 60 * 60 * 1000))
        : 0;

      const retention = Math.exp(-elapsedDays / stabilityDays);
      totalRetentionSum += retention;
    }

    const overallRetentionRate = Number(((totalRetentionSum / cards.length) * 100).toFixed(1));

    // Calculate 30-day forgetting curve projection
    const forgettingCurve: RetentionCurvePoint[] = [];
    for (let day = 1; day <= 30; day++) {
      let dayRetentionSum = 0;
      for (const card of cards) {
        const stabilityDays = Math.max(0.1, card.stability);
        const elapsedDays = card.lastReview
          ? Math.max(0, (now.getTime() - card.lastReview.getTime()) / (24 * 60 * 60 * 1000)) + day
          : day;
        const retention = Math.exp(-elapsedDays / stabilityDays);
        dayRetentionSum += retention;
      }
      const dayRate = Number(((dayRetentionSum / cards.length) * 100).toFixed(1));
      forgettingCurve.push({ day, retentionRate: dayRate });
    }

    return {
      totalCards: cards.length,
      overallRetentionRate,
      masteryBreakdown: breakdown,
      forgettingCurve,
    };
  }

  /**
   * Today's real review-event metrics. Earlier this method returned lifetime
   * card counters under a "today" label and used lesson exercise timings; both
   * were plausible-looking but described different datasets.
   */
  async getReviewAnalytics(userId: string): Promise<ReviewAnalyticsResponse> {
    const userObjectId = new Types.ObjectId(userId);
    const [cards, user, eventWindow] = await Promise.all([
      this.srsCardModel.find({ userId: userObjectId }).exec(),
      this.userService.findById(userId),
      this.analyticsService.listReviewEvents(userId, {
        since: new Date(Date.now() - 48 * 60 * 60 * 1000),
      }),
    ]);
    if (!user) throw new NotFoundException('User not found');
    const today = localDateString(new Date(), user.settings.tz);
    const events = eventWindow.filter(
      (event) => localDateString(event.ts, user.settings.tz) === today,
    );
    const successful = events.filter(
      (event) => event.payload.grade === 'good' || event.payload.grade === 'easy',
    ).length;
    const validTimes = events
      .map((event) => event.payload.responseTimeMs)
      .filter((value): value is number => typeof value === 'number' && value > 0);
    return {
      totalReviewsToday: events.length,
      accuracyRateToday: events.length > 0 ? Number((successful / events.length).toFixed(2)) : 0,
      averageResponseTimeMs: validTimes.length > 0
        ? Math.round(validTimes.reduce((sum, value) => sum + value, 0) / validTimes.length)
        : 0,
      masteredCount: cards.filter((card) => computeMastery(card) === 'mastered').length,
    };
  }
}
