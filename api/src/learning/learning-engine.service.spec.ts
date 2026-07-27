import { LearningEngineService } from './learning-engine.service';
import { ContentService } from '../content/content.service';
import { KnowledgeGraphService } from '../knowledge-graph/knowledge-graph.service';
import { Types } from 'mongoose';

const USER_ID = '607f1f77bcf86cd799439011';
const LESSON_ID = '507f1f77bcf86cd799439011';

describe('LearningEngineService', () => {
  let service: LearningEngineService;
  let srsCardModel: { findOne: jest.Mock; find: jest.Mock };
  let attemptModel: { find: jest.Mock };
  let contentService: { findLessonById: jest.Mock };
  let knowledgeGraph: { findNodeByRef: jest.Mock };

  beforeEach(() => {
    srsCardModel = {
      findOne: jest.fn(),
      find: jest.fn(),
    };
    attemptModel = {
      find: jest.fn(),
    };
    contentService = {
      findLessonById: jest.fn(),
    };
    knowledgeGraph = {
      findNodeByRef: jest.fn(),
    };

    service = new LearningEngineService(
      srsCardModel as never,
      attemptModel as never,
      contentService as unknown as ContentService,
      knowledgeGraph as unknown as KnowledgeGraphService,
    );
  });

  describe('getReadiness', () => {
    it('returns readiness score 1.0 and status ready when lesson has no prerequisites', async () => {
      contentService.findLessonById.mockResolvedValue({
        id: LESSON_ID,
        prerequisiteLessonIds: [],
        items: [],
      });

      const result = await service.getReadiness(USER_ID, LESSON_ID);

      expect(result.readinessScore).toBe(1.0);
      expect(result.status).toBe('ready');
      expect(result.masteredPrerequisites).toBe(0);
    });

    it('calculates readiness score based on mastered prerequisite cards', async () => {
      const prereqId = new Types.ObjectId();
      contentService.findLessonById.mockImplementation((id: string) => {
        if (id === LESSON_ID) {
          return Promise.resolve({
            id: LESSON_ID,
            prerequisiteLessonIds: [prereqId],
            items: [],
          });
        }
        return Promise.resolve({
          id: prereqId.toString(),
          prerequisiteLessonIds: [],
          items: [{ id: '507f1f77bcf86cd799439099', kana: 'あ' }],
        });
      });

      srsCardModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          state: 'review',
          stability: 15,
          reps: 4,
        }),
      });

      const result = await service.getReadiness(USER_ID, LESSON_ID);

      expect(result.readinessScore).toBe(1.0);
      expect(result.status).toBe('ready');
      expect(result.masteredPrerequisites).toBe(1);
    });
  });

  describe('getMemoryModel', () => {
    it('returns default empty memory model when user has no cards', async () => {
      srsCardModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      const result = await service.getMemoryModel(USER_ID);

      expect(result.totalCards).toBe(0);
      expect(result.overallRetentionRate).toBe(100);
      expect(result.forgettingCurve).toHaveLength(30);
    });

    it('calculates overall retention rate and 30-day forgetting curve from card stabilities', async () => {
      const now = new Date();
      srsCardModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          { state: 'review', stability: 10, reps: 3, lastReview: now },
          { state: 'review', stability: 25, reps: 6, lastReview: now },
        ]),
      });

      const result = await service.getMemoryModel(USER_ID);

      expect(result.totalCards).toBe(2);
      expect(result.overallRetentionRate).toBeGreaterThan(90);
      expect(result.forgettingCurve).toHaveLength(30);
      expect(result.forgettingCurve[0].day).toBe(1);
    });
  });

  describe('getReviewAnalytics', () => {
    it('aggregates total reviews, accuracy rate, average response time, and mastered count', async () => {
      srsCardModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          { state: 'review', stability: 35, reps: 8, totalReviews: 10, correctReviews: 8 },
        ]),
      });

      attemptModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([{ responseTimeMs: 1200 }, { responseTimeMs: 1800 }]),
        }),
      });

      const result = await service.getReviewAnalytics(USER_ID);

      expect(result.totalReviewsToday).toBe(10);
      expect(result.accuracyRateToday).toBe(0.8);
      expect(result.averageResponseTimeMs).toBe(1500);
      expect(result.masteredCount).toBe(1);
    });
  });
});
