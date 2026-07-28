import { LearningEngineService } from './learning-engine.service';
import { ContentService } from '../content/content.service';
import { Types } from 'mongoose';

const USER_ID = '607f1f77bcf86cd799439011';
const LESSON_ID = '507f1f77bcf86cd799439011';

describe('LearningEngineService', () => {
  let service: LearningEngineService;
  let srsCardModel: { findOne: jest.Mock; find: jest.Mock };
  let attemptModel: { find: jest.Mock };
  let contentService: { findLessonById: jest.Mock };

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
    service = new LearningEngineService(
      srsCardModel as never,
      attemptModel as never,
      contentService as unknown as ContentService,
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
      const itemId = '507f1f77bcf86cd799439099';
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
          items: [{ id: itemId, kana: 'あ' }],
        });
      });

      srsCardModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            itemRef: { id: new Types.ObjectId(itemId) },
            state: 'review',
            stability: 15,
            reps: 4,
          },
        ]),
      });

      const result = await service.getReadiness(USER_ID, LESSON_ID);

      expect(result.readinessScore).toBe(1.0);
      expect(result.status).toBe('ready');
      expect(result.masteredPrerequisites).toBe(1);
    });

    /**
     * The shape that matters after the ADR-005 slice: cards are fetched in **one**
     * query keyed on every prerequisite item, not one `findOne` per item inside a
     * nested loop. A lesson with two 30-item prerequisites was 60 sequential round
     * trips on a screen-load call.
     */
    it('fetches every prerequisite card in a single query', async () => {
      const prereqId = new Types.ObjectId();
      const itemA = '507f1f77bcf86cd7994390a1';
      const itemB = '507f1f77bcf86cd7994390a2';
      contentService.findLessonById.mockImplementation((id: string) =>
        Promise.resolve(
          id === LESSON_ID
            ? { id: LESSON_ID, prerequisiteLessonIds: [prereqId], items: [] }
            : {
                id: prereqId.toString(),
                prerequisiteLessonIds: [],
                items: [
                  { id: itemA, kana: 'あ' },
                  { id: itemB, kana: 'い' },
                ],
              },
        ),
      );
      srsCardModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });

      await service.getReadiness(USER_ID, LESSON_ID);

      expect(srsCardModel.find).toHaveBeenCalledTimes(1);
      expect(srsCardModel.findOne).not.toHaveBeenCalled();
      const filter = srsCardModel.find.mock.calls[0][0] as {
        'itemRef.id': { $in: Types.ObjectId[] };
      };
      expect(filter['itemRef.id'].$in.map(String)).toEqual([itemA, itemB]);
    });

    it('counts an item with no card as unmastered and names it in the response', async () => {
      const prereqId = new Types.ObjectId();
      const mastered = '507f1f77bcf86cd7994390b1';
      const unseen = '507f1f77bcf86cd7994390b2';
      contentService.findLessonById.mockImplementation((id: string) =>
        Promise.resolve(
          id === LESSON_ID
            ? { id: LESSON_ID, prerequisiteLessonIds: [prereqId], items: [] }
            : {
                id: prereqId.toString(),
                prerequisiteLessonIds: [],
                items: [
                  { id: mastered, kana: 'あ' },
                  { id: unseen, kana: 'い' },
                ],
              },
        ),
      );
      srsCardModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          { itemRef: { id: new Types.ObjectId(mastered) }, state: 'review', stability: 20, reps: 5 },
        ]),
      });

      const result = await service.getReadiness(USER_ID, LESSON_ID);

      expect(result.masteredPrerequisites).toBe(1);
      expect(result.totalPrerequisites).toBe(2);
      expect(result.readinessScore).toBe(0.5);
      // 0.5 sits in the middle band, so it is not `locked` either.
      expect(result.status).toBe('needs_review');
      // Labels, not ids — a client shows these to the learner.
      expect(result.unmasteredPrerequisites).toEqual(['い']);
    });

    /**
     * A card that exists but is still `new` or `learning` is not retention. It
     * used to be easy to get this wrong: the old code called `computeMastery`
     * twice per item and compared strings inline.
     */
    it('does not count a card below `familiar` as mastered', async () => {
      const prereqId = new Types.ObjectId();
      const itemId = '507f1f77bcf86cd7994390c1';
      contentService.findLessonById.mockImplementation((id: string) =>
        Promise.resolve(
          id === LESSON_ID
            ? { id: LESSON_ID, prerequisiteLessonIds: [prereqId], items: [] }
            : {
                id: prereqId.toString(),
                prerequisiteLessonIds: [],
                items: [{ id: itemId, kana: 'あ' }],
              },
        ),
      );
      srsCardModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          { itemRef: { id: new Types.ObjectId(itemId) }, state: 'learning', stability: 1, reps: 1 },
        ]),
      });

      const result = await service.getReadiness(USER_ID, LESSON_ID);

      expect(result.masteredPrerequisites).toBe(0);
      expect(result.status).toBe('locked');
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
