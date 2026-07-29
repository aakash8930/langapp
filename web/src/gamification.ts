import type { Progress } from './api';

/**
 * The reward layer: level tiers and achievements.
 *
 * ## Everything here is derived from `/me/progress`
 *
 * No badge state is stored anywhere — server or client. An achievement is a
 * predicate over the progress the API already returns, evaluated on render.
 * That is a deliberate limit rather than a shortcut, and it decides which
 * achievements can exist at all: **if the API cannot answer it, it is not on
 * this list.**
 *
 * Three from the original sketch were dropped for exactly that reason, and they
 * are worth naming so nobody re-adds them by guessing:
 *
 *   - *Night owl* (studied after 10pm) — nothing records the clock time of a
 *     study session. `lastStudyDate` is a date string, not an instant.
 *   - *Perfect run* — the web quiz is pass-or-repeat, so every completion is
 *     already clean; the badge would unlock with the first lesson and mean
 *     nothing. (`LessonQuiz` explains why the re-ask loop went away.)
 *   - *100 reviews* — `daily.reviewsDone` is today's count only. There is no
 *     lifetime review total on the wire; `/learning/memory-model` has
 *     `totalCards`, which is a different thing.
 *
 * Each needs a server change to become honest. Until then, a badge that lit up
 * on a guess would be worse than an absent one: the whole point of the row is
 * that the ticks are true.
 */

/** Metal bands over the server's level. See `levelTier` for the thresholds. */
export type Tier = 'bronze' | 'silver' | 'gold' | 'diamond' | 'master';

/**
 * Chosen against the server's flat 100-XP-per-level curve
 * (`api/src/user/gamification/level.ts`), so bronze covers roughly the first
 * week and master is a long haul: silver at 500 XP, gold at 1000, diamond at
 * 2000, master at 3500.
 */
export function levelTier(level: number): Tier {
  if (level >= 36) return 'master';
  if (level >= 21) return 'diamond';
  if (level >= 11) return 'gold';
  if (level >= 6) return 'silver';
  return 'bronze';
}

export type Achievement = {
  id: string;
  icon: string;
  title: string;
  /** Shown once unlocked. */
  earned: string;
  /** Shown while locked — says what to do, never just "locked". */
  goal: string;
  unlocked: boolean;
  /** 0–1, for the sliver of fill on a locked badge. Null when not meaningful. */
  progress: number | null;
};

/** Clamped 0–1, guarding the divide so a zero target cannot produce NaN. */
function ratio(current: number, target: number): number {
  if (target <= 0) return 1;
  return Math.min(Math.max(current / target, 0), 1);
}

/**
 * The full badge set, unlocked ones first and the rest in teaching order.
 *
 * Locked badges stay visible rather than hidden — a row that grows as you earn
 * things tells you nothing about what is next, and "what is next" is the only
 * reason to look at it. They are described, not blanked out: a `?` would be
 * mysterious in the unhelpful sense, since none of these are surprises worth
 * protecting.
 *
 * **Locked badges keep their declared order rather than sorting by progress.**
 * Sorting by the `progress` fraction looked right and read wrong: the ratios
 * measure different things, so a brand-new account showed "Reach level 11"
 * (0.09) ahead of "Finish your first lesson" (0.00) — putting a 1000-XP goal
 * in front of a five-minute one. The declared order below is a deliberate
 * progression, and it is the honest answer to "what next".
 */
export function achievementsFor(progress: Progress): Achievement[] {
  const lessons = progress.lessonsCompleted;
  const streak = progress.streakDays;
  const level = progress.level;
  const reviewsToday = progress.daily.reviewsDone;

  const all: Achievement[] = [
    {
      id: 'first-lesson',
      icon: '🌱',
      title: 'First steps',
      earned: 'You finished your first lesson.',
      goal: 'Finish your first lesson.',
      unlocked: lessons >= 1,
      progress: ratio(lessons, 1),
    },
    {
      id: 'lessons-5',
      icon: '📗',
      title: 'Getting going',
      earned: 'Five lessons finished.',
      goal: `Finish 5 lessons — ${lessons} so far.`,
      unlocked: lessons >= 5,
      progress: ratio(lessons, 5),
    },
    {
      id: 'lessons-25',
      icon: '📚',
      title: 'Well read',
      earned: 'Twenty-five lessons finished.',
      goal: `Finish 25 lessons — ${lessons} so far.`,
      unlocked: lessons >= 25,
      progress: ratio(lessons, 25),
    },
    {
      id: 'streak-3',
      icon: '🔥',
      title: 'Three in a row',
      earned: 'A three-day streak.',
      goal: `Study three days running — ${streak} so far.`,
      unlocked: streak >= 3,
      progress: ratio(streak, 3),
    },
    {
      id: 'streak-7',
      icon: '🗓️',
      title: 'A full week',
      earned: 'A seven-day streak.',
      goal: `Study seven days running — ${streak} so far.`,
      unlocked: streak >= 7,
      progress: ratio(streak, 7),
    },
    {
      id: 'streak-30',
      icon: '🏔️',
      title: 'A month of it',
      earned: 'A thirty-day streak.',
      goal: `Study thirty days running — ${streak} so far.`,
      unlocked: streak >= 30,
      progress: ratio(streak, 30),
    },
    {
      id: 'level-5',
      icon: '🥈',
      title: 'Silver',
      earned: 'You reached level 5.',
      goal: `Reach level 5 — you are level ${level}.`,
      unlocked: level >= 5,
      progress: ratio(level, 5),
    },
    {
      id: 'level-11',
      icon: '🥇',
      title: 'Gold',
      earned: 'You reached level 11.',
      goal: `Reach level 11 — you are level ${level}.`,
      unlocked: level >= 11,
      progress: ratio(level, 11),
    },
    {
      id: 'goal-today',
      icon: '🎯',
      title: 'Goal met',
      earned: "Today's XP goal is done.",
      goal: `Hit today's goal — ${progress.daily.xpToday} of ${progress.daily.goalXp} XP.`,
      unlocked: progress.daily.goalMet,
      progress: ratio(progress.daily.xpToday, progress.daily.goalXp),
    },
    {
      id: 'reviews-10-today',
      icon: '♻️',
      title: 'Ten reviews',
      earned: 'Ten reviews cleared today.',
      goal: `Clear 10 reviews today — ${reviewsToday} so far.`,
      unlocked: reviewsToday >= 10,
      progress: ratio(reviewsToday, 10),
    },
  ];

  // Stable partition, not a full sort: earned badges to the front, everything
  // else in the order declared above. `Array.prototype.sort` is required to be
  // stable, so comparing only on `unlocked` preserves that order exactly.
  return [...all].sort((a, b) => Number(b.unlocked) - Number(a.unlocked));
}
