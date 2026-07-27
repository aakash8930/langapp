import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ContentService } from '../content/content.service';
import { KnowledgeGraphService } from '../knowledge-graph/knowledge-graph.service';
import { computeMastery, MasteryLevel, SrsCard, SrsCardDocument } from './schemas/srs-card.schema';
import { ExerciseAttempt, ExerciseAttemptDocument } from './schemas/exercise-attempt.schema';

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
    @InjectModel(ExerciseAttempt.name) private readonly attemptModel: Model<ExerciseAttemptDocument>,
    private readonly contentService: ContentService,
    private readonly knowledgeGraph: KnowledgeGraphService,
  ) {}

  /**
   * Calculates the learner's readiness score (0.0 to 1.0) for a given lesson
   * by evaluating how many prerequisite items/lessons have been mastered.
   */
  async getReadiness(userId: string, lessonId: string): Promise<ReadinessResponse> {
    const lesson = await this.contentService.findLessonById(lessonId);
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    const prereqLessonIds = lesson.prerequisiteLessonIds || [];
    const lessonNode = await this.knowledgeGraph.findNodeByRef('lesson', new Types.ObjectId(lessonId));
    if (lessonNode) {
      await this.knowledgeGraph.findPrerequisites(lessonNode._id);
    }
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
    const userObjectId = new Types.ObjectId(userId);
    const prereqLessons = await Promise.all(
      prereqLessonIds.map((id) => this.contentService.findLessonById(id.toString())),
    );

    const unmastered: string[] = [];
    let masteredCount = 0;
    let totalPrereqs = 0;

    for (const prereqLesson of prereqLessons) {
      if (!prereqLesson) continue;
      for (const item of prereqLesson.items) {
        totalPrereqs++;
        const card = await this.srsCardModel
          .findOne({
            userId: userObjectId,
            'itemRef.id': new Types.ObjectId(item.id),
          })
          .exec();

        if (card && (computeMastery(card) === 'familiar' || computeMastery(card) === 'mastered')) {
          masteredCount++;
        } else {
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
   * Aggregates review session performance metrics for the learner.
   */
  async getReviewAnalytics(userId: string): Promise<ReviewAnalyticsResponse> {
    const userObjectId = new Types.ObjectId(userId);
    const cards = await this.srsCardModel.find({ userId: userObjectId }).exec();

    let totalReviews = 0;
    let correctReviews = 0;
    let masteredCount = 0;

    for (const card of cards) {
      totalReviews += card.totalReviews || 0;
      correctReviews += card.correctReviews || 0;
      if (computeMastery(card) === 'mastered') {
        masteredCount++;
      }
    }

    const accuracyRateToday = totalReviews > 0 ? Number((correctReviews / totalReviews).toFixed(2)) : 0;

    // Calculate average response time from exercise attempts
    const attempts = await this.attemptModel
      .find({ userId: userObjectId, responseTimeMs: { $ne: null } })
      .select('responseTimeMs')
      .exec();

    const validTimes = attempts
      .map((a) => a.responseTimeMs)
      .filter((t): t is number => typeof t === 'number');

    const averageResponseTimeMs =
      validTimes.length > 0
        ? Math.round(validTimes.reduce((a, b) => a + b, 0) / validTimes.length)
        : 0;

    return {
      totalReviewsToday: totalReviews,
      accuracyRateToday,
      averageResponseTimeMs,
      masteredCount,
    };
  }
}
