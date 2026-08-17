export interface CompleteLessonResponse {
  lessonId: string;
  title: string;
  /**
   * What this call actually awarded: the full completion award the first time,
   * the smaller practice award on every repeat.
   */
  xpAwarded: number;
  /**
   * True only on the completion that created the record. Lets a client show a
   * "lesson complete" summary once and a "practice again" one thereafter,
   */
  firstCompletion: boolean;
  /** The user's XP after the award, so a client needn't re-fetch /me. */
  totalXp: number;
}
