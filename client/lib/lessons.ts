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

/**
 * Display names for unit slugs.
 *
 * A client-side map rather than a field on the API, because the alternative is
 * a units endpoint and a Unit collection to serve two rows of static text. The
 * cost is that a new unit needs an edit here — and the fallback below means
 * forgetting is untidy, not broken.
 */
const UNIT_LABELS: Record<string, string> = {
  'hiragana-basics': 'Hiragana basics',
  'katakana-basics': 'Katakana basics',
  'vocab-basics': 'First words',
};

/**
 * Teaching order. The server sorts by slug, which puts hiragana before katakana
 * alphabetically — correct here by luck, and not something to depend on. A unit
 * missing from this list sorts after the known ones rather than vanishing.
 */
const UNIT_ORDER = ['hiragana-basics', 'katakana-basics', 'vocab-basics'];

export type UnitGroup = {
  unit: string;
  label: string;
  lessons: LessonWithState[];
  completedCount: number;
};

export function groupByUnit(lessons: LessonWithState[]): UnitGroup[] {
  const byUnit = new Map<string, LessonWithState[]>();

  for (const lesson of lessons) {
    const existing = byUnit.get(lesson.unit);
    if (existing) existing.push(lesson);
    else byUnit.set(lesson.unit, [lesson]);
  }

  return [...byUnit.entries()]
    .map(([unit, unitLessons]) => ({
      unit,
      label: UNIT_LABELS[unit] ?? unit,
      lessons: unitLessons,
      completedCount: unitLessons.filter((lesson) => lesson.completed).length,
    }))
    .sort((a, b) => unitRank(a.unit) - unitRank(b.unit));
}

function unitRank(unit: string): number {
  const index = UNIT_ORDER.indexOf(unit);
  return index === -1 ? UNIT_ORDER.length : index;
}
