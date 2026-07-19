export interface CompleteLessonResponse {
  lessonId: string;
  title: string;
  /** Cards created by this call. Zero on a repeat completion. */
  cardsCreated: number;
  /** Items that already had a card, so were left untouched. */
  cardsAlreadyPresent: number;
  xpAwarded: number;
  /** The user's XP after the award, so a client needn't re-fetch /me. */
  totalXp: number;
}
