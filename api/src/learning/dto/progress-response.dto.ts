import type { StartingRecommendation } from '../starting-recommendation';

/**
 * The /me/progress payload — the learner's whole dashboard in one call, so a
 * client doesn't have to stitch account and lesson-completion state together.
 *
 * Like UserResponse, this is an explicit allowlist rather than a spread of the
 * user document: progress is a read-only projection and must never become a
 * second path through which a schema field leaks out.
 */
export interface ProgressResponse {
  xp: number;
  /** Derived from xp on read, never persisted — see gamification/level.ts. */
  level: number;
  /** XP earned inside the current level, and what the level costs. */
  xpIntoLevel: number;
  xpForNextLevel: number;

  streakDays: number;
  /** 'YYYY-MM-DD' in the user's own tz, or null before their first action. */
  lastStudyDate: string | null;

  daily: {
    /** Zero once the user's local day turns, even before the next award lands. */
    xpToday: number;
    goalXp: number;
    /** Clamped to 100 so a big day can't overflow a progress ring. */
    percentOfGoal: number;
    goalMet: boolean;
    /**
     * What the learner actually *did* today, counted from the event log rather
     * than a stored counter (T1.8).
     *
     * This answers the question XP cannot: whether the learner completed a lesson today.
     *
     * Counted on *their* local day, the same rule `xpToday` follows — so these
     * reset together and can never disagree about when today started.
     */
    lessonsDone: number;
  };

  /** Distinct lessons completed at least once. Always `completedLessonIds.length`. */
  lessonsCompleted: number;
  /**
   * Which lessons are done, not just how many.
   *
   * The client needs this to derive lock state: a lesson unlocks once every id
   * in its `prerequisiteLessonIds` appears here. A count cannot answer that, and
   * nothing else on the API exposes it.
   */
  completedLessonIds: string[];
  /**
   * Which units the learner has passed a checkpoint on — sorted, deduplicated,
   * and **unit slugs** (`'hiragana-basics'`), not Mongo ids.
   *
   * That is the trap worth naming: this sits beside `completedLessonIds`, which
   * holds ids, so the two look interchangeable and are not. These match
   * `Lesson.unit` and the `?unit=` query, which is what a client needs to tick a
   * row in its unit list.
   *
   * **It is not access control, and nothing on the server treats it as any.**
   * Passing a checkpoint is not required to progress (§3.1 reasoning — failing
   * costs missed items coming back sooner, not a closed door), so a client that
   * draws a tick from this is decorating a unit list, not gating one. A unit
   * that never appears here is a unit whose test has not been passed, which is
   * not the same as one the learner cannot reach.
   *
   * Only *passed* attempts count. An open or failed attempt is absent, so this
   * never says "tested" about a test that was failed or abandoned.
   */
  passedUnits: string[];
  /** Deterministic curriculum target derived from persisted onboarding answers. */
  startingRecommendation: StartingRecommendation;
}
