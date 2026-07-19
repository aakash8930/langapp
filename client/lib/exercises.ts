/** The API accepts 0–10000 (FindExercisesDto). */
const MAX_ATTEMPT = 10000;

/**
 * Picks the seed for one run through a lesson.
 *
 * The server has no per-user attempt counter yet, so the client chooses. It
 * must be drawn once and held for the whole lesson — re-drawing mid-lesson
 * would reshuffle the questions under the learner and invalidate the
 * `exerciseId`s already on screen. Drawing a fresh one per entry is what makes
 * practising a finished lesson a different quiz rather than the same five
 * cards in the same order.
 */
export function newAttempt(): number {
  return Math.floor(Math.random() * (MAX_ATTEMPT + 1));
}
