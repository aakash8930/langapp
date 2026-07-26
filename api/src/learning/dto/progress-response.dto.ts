/**
 * The /me/progress payload — the learner's whole dashboard in one call, so a
 * client doesn't have to stitch /me together with /reviews/due.
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
     * These answer the question XP cannot: 30 XP could be three lessons or
     * fifteen reviews, and "you have done nothing today" versus "you have done
     * your reviews, the goal is just set high" are different messages for a home
     * screen to show.
     *
     * Counted on *their* local day, the same rule `xpToday` follows — so these
     * reset together and can never disagree about when today started.
     */
    reviewsDone: number;
    lessonsDone: number;
  };

  /** Cards whose `due` has passed as of this request. */
  cardsDueNow: number;
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
}
