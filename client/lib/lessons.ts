import type { LessonSummary } from '@/api/lessons';

export type LessonWithState = LessonSummary & {
  completed: boolean;
  /** True until every prerequisite is complete. */
  locked: boolean;
  /**
   * Title of the first prerequisite still outstanding, so a locked row can say
   * what opens it instead of just refusing.
   */
  lockedBy?: string;
};

/**
 * Lock state is derived on the client because the server does not compute it —
 * `/lessons` is shared, unauthenticated content with no per-user fields. The
 * completed set comes from `/me/progress`.
 *
 * A lesson with no prerequisites is always open, which is what makes the first
 * lesson of a unit reachable from a standing start.
 */
export function withLockState(
  lessons: LessonSummary[],
  completedLessonIds: string[],
): LessonWithState[] {
  const completed = new Set(completedLessonIds);
  const titleById = new Map(lessons.map((lesson) => [lesson.id, lesson.title]));

  return lessons
    .map((lesson) => {
      const blocker = lesson.prerequisiteLessonIds.find((id) => !completed.has(id));

      return {
        ...lesson,
        completed: completed.has(lesson.id),
        locked: blocker !== undefined,
        // A prerequisite outside the requested unit won't be in the map. Better
        // to say nothing than to name it "undefined".
        lockedBy: blocker ? titleById.get(blocker) : undefined,
      };
    })
    // The server returns them ordered, but `order` is the field that means it.
    .sort((a, b) => a.order - b.order);
}

/** The lesson to nudge someone toward: the first one they can actually open. */
export function firstAvailableLesson(lessons: LessonWithState[]): LessonWithState | undefined {
  return lessons.find((lesson) => !lesson.locked && !lesson.completed);
}
