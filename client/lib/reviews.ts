import type { GradeResult, ReviewGrade } from '@/api/reviews';

/**
 * A lapse is the one grade that means "I did not recall this". FSRS treats the
 * other three as successful recall at differing confidence, so accuracy on a
 * review session is the share of cards that were not `again`.
 */
export function isRecall(grade: ReviewGrade): boolean {
  return grade !== 'again';
}

export type SessionStats = {
  /** Grades the server confirmed. A failed POST is not a review. */
  reviewed: number;
  recalled: number;
  /** Rounded whole percent. Zero when nothing was reviewed. */
  accuracyPercent: number;
  xpEarned: number;
  /** Minutes until the soonest card returns, or null if none were graded. */
  nextDueMinutes: number | null;
};

export function summarize(results: GradeResult[]): SessionStats {
  const recalled = results.filter((result) => isRecall(result.grade)).length;
  const xpEarned = results.reduce((total, result) => total + result.xpAwarded, 0);

  // The soonest return, not the average: it is what tells someone whether it is
  // worth waiting around for another pass.
  const nextDueMinutes = results.length
    ? Math.min(...results.map((result) => result.intervalMinutes))
    : null;

  return {
    reviewed: results.length,
    recalled,
    accuracyPercent: results.length ? Math.round((recalled / results.length) * 100) : 0,
    xpEarned,
    nextDueMinutes,
  };
}

/**
 * Relative time, coarsened on purpose. "in 8 days" is the useful shape of the
 * answer; "in 11520 minutes" is the same fact rendered useless.
 */
export function formatInterval(minutes: number): string {
  if (minutes < 1) return 'in under a minute';
  if (minutes < 60) return `in ${count(minutes, 'minute')}`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `in ${count(hours, 'hour')}`;

  return `in ${count(Math.round(minutes / (60 * 24)), 'day')}`;
}

function count(value: number, noun: string): string {
  return `${value} ${noun}${value === 1 ? '' : 's'}`;
}
