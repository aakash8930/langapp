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
  'hiragana-marks': 'Hiragana: marks and combinations',
  'katakana-marks': 'Katakana: marks and combinations',
  'hiragana-marks-extra': 'Hiragana: っ and ー',
  'katakana-marks-extra': 'Katakana: ッ and ー',
  'vocab-everyday': 'Everyday words',
  'grammar-basics': 'First sentences',
  'kanji-basics': 'First kanji',
};

/**
 * Teaching order. The server sorts by slug, which puts hiragana before katakana
 * alphabetically — correct here by luck, and not something to depend on. A unit
 * missing from this list sorts after the known ones rather than vanishing.
 *
 * **This list must match the seed's chain** (`api/src/seed/seed.service.ts`'s
 * `ORDERED_PACKS`, then grammar, then kanji). It drifted once already: the four
 * units added on 2026-07-26 were absent, so they fell through to rank
 * `UNIT_ORDER.length` and sorted *after* `grammar-basics` — which put the
 * grammar chapter before the two marks-extra units and `vocab-everyday` that
 * actually precede it. The fallback keeps that untidy rather than broken, which
 * is exactly why it went unnoticed. If you add a unit to the seed, add it here.
 */
const UNIT_ORDER = [
  'hiragana-basics',
  'katakana-basics',
  'vocab-basics',
  'hiragana-marks',
  'katakana-marks',
  'hiragana-marks-extra',
  'katakana-marks-extra',
  'vocab-everyday',
  'grammar-basics',
  'kanji-basics',
];

/**
 * Where a unit sits relative to the learner, which is what decides how much of
 * it the path draws.
 *
 * With ten units and 58 lessons, drawing every lesson at once is the problem the
 * path exists to solve — a flat list that long has no sense of place. So `done`
 * units collapse to one line, `locked` units to a chapter heading, and only the
 * `current` one is expanded. That is the whole trick.
 */
export type UnitStatus = 'done' | 'current' | 'locked';

export type UnitGroup = {
  unit: string;
  label: string;
  lessons: LessonWithState[];
  completedCount: number;
  status: UnitStatus;
  /** Index among all units, so the path can number chapters. */
  index: number;
};

/**
 * The one lesson the whole screen points at: the first openable, unfinished
 * lesson in teaching order.
 *
 * Takes *grouped* units rather than a flat list, and that matters: every unit
 * numbers its lessons from 0, so scanning a flat array sorted by `order` picks
 * whichever unit happened to sort first rather than the one the learner is on.
 * This replaced a flat `firstAvailableLesson` for exactly that reason.
 */
export function nextLesson(units: UnitGroup[]): LessonWithState | undefined {
  for (const unit of units) {
    const candidate = unit.lessons.find((lesson) => !lesson.locked && !lesson.completed);
    if (candidate) return candidate;
  }
  return undefined;
}

export function groupByUnit(lessons: LessonWithState[]): UnitGroup[] {
  const byUnit = new Map<string, LessonWithState[]>();

  for (const lesson of lessons) {
    const existing = byUnit.get(lesson.unit);
    if (existing) existing.push(lesson);
    else byUnit.set(lesson.unit, [lesson]);
  }

  const ordered = [...byUnit.entries()]
    .map(([unit, unitLessons]) => ({
      unit,
      label: UNIT_LABELS[unit] ?? unit,
      lessons: unitLessons,
      completedCount: unitLessons.filter((lesson) => lesson.completed).length,
    }))
    .sort((a, b) => unitRank(a.unit) - unitRank(b.unit));

  // `current` is the first unit with anything still to do. Everything before it
  // is done; everything after is locked — which is true by construction, since
  // the chain gates each unit's first lesson on the previous unit's last.
  const currentIndex = ordered.findIndex(
    (group) => group.completedCount < group.lessons.length,
  );

  return ordered.map((group, index) => ({
    ...group,
    index,
    status:
      currentIndex === -1 || index < currentIndex
        ? ('done' as const)
        : index === currentIndex
          ? ('current' as const)
          : ('locked' as const),
  }));
}

function unitRank(unit: string): number {
  const index = UNIT_ORDER.indexOf(unit);
  return index === -1 ? UNIT_ORDER.length : index;
}
