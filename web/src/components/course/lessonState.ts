import type { LessonSummary } from '../../api';

/**
 * Lock state is derived here, not served: `/lessons` is shared, unauthenticated
 * content with no per-user fields, and the completed set comes from
 * `/me/progress`. Signed out, `completedLessonIds` is null and nothing is
 * locked — a visitor browsing the syllabus should see all of it.
 */
export type LessonState = { completed: boolean; locked: boolean; lockedBy?: string };

/**
 * Builds the `stateOf` predicate the module and lesson rows share.
 *
 * A factory rather than a hook because it is pure and the caller already has
 * both inputs; it exists so the completed-set and the prerequisite lookup are
 * constructed once per render of the page instead of once per lesson row.
 *
 * In its own module rather than beside `LessonRow` so that file exports only
 * components — mixing a component and a helper in one file breaks React Fast
 * Refresh, which silently degrades every edit to a full reload.
 */
export function lessonStateReader(
  completedLessonIds: string[] | null,
  titleById: Map<string, string>,
): (lesson: LessonSummary) => LessonState {
  if (completedLessonIds === null) {
    return () => ({ completed: false, locked: false });
  }

  const done = new Set(completedLessonIds);

  return (lesson) => {
    const blocker = lesson.prerequisiteLessonIds.find((id) => !done.has(id));
    return {
      completed: done.has(lesson.id),
      locked: blocker !== undefined,
      lockedBy: blocker ? titleById.get(blocker) : undefined,
    };
  };
}
