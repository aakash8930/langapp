import { api } from './client';

/** Mirrors ProgressResponse in api/src/learning/dto/progress-response.dto.ts. */
export type Progress = {
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  streakDays: number;
  /** 'YYYY-MM-DD' in the user's own tz, or null before their first action. */
  lastStudyDate: string | null;
  daily: {
    xpToday: number;
    goalXp: number;
    /** Already clamped to 100 by the server. */
    percentOfGoal: number;
    goalMet: boolean;
    /**
     * What was actually done today, counted on the user's local day like
     * `xpToday`. These say what XP cannot: 30 XP is three lessons or fifteen
     * reviews, and those deserve different sentences on the home screen.
     */
    reviewsDone: number;
    lessonsDone: number;
  };
  cardsDueNow: number;
  lessonsCompleted: number;
  /** Drives lesson lock state. See lib/lessons.ts. */
  completedLessonIds: string[];
};

export function fetchProgress(): Promise<Progress> {
  return api.get<Progress>('/me/progress');
}
