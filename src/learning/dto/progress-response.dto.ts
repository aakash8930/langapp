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
  };

  /** Cards whose `due` has passed as of this request. */
  cardsDueNow: number;
  /** Distinct lessons completed at least once. */
  lessonsCompleted: number;
}
