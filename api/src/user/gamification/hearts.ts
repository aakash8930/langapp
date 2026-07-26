import { MAX_HEARTS } from '../schemas/user.schema';

/** Fallback when `HEARTS_REGEN_MINUTES` is absent. */
export const DEFAULT_HEARTS_REGEN_MINUTES = 30;

/** What it costs in gems to refill from any number of hearts back to full. */
export const GEM_COST_HEART_REFILL = 50;

/** Gems paid for a first completion, and for each practice repeat after it. */
export const GEMS_PER_LESSON_COMPLETION = 10;
export const GEMS_PER_LESSON_PRACTICE = 2;

export interface HeartState {
  hearts: number;
  heartsUpdatedAt: Date | null;
}

/**
 * Hearts as they should be *read*, which is rarely what is stored.
 *
 * Kept free of Mongo so it can be tested directly, the same way `streak.ts` is —
 * and for the same reason: this is arithmetic with edge cases, and the edges are
 * where it will be wrong.
 *
 * ## The rule
 *
 * One heart returns every `regenMinutes`, measured from `heartsUpdatedAt`, capped
 * at `MAX_HEARTS`. A learner at full hearts has nothing to regenerate, so a null
 * `heartsUpdatedAt` (a fresh account, never dinged) reads as full.
 *
 * ## Why the stored value is not the current value
 *
 * Nothing rewrites the row while the learner is away, so `hearts` is the count at
 * `heartsUpdatedAt` and the elapsed time is the rest of the answer. The
 * alternative — a scheduled job topping every account up — would put the same
 * number in two places and need Redis or BullMQ to be reliable. `todayXp` already
 * works this way (`UserService.todayXpFor`), so this is the established pattern
 * here rather than a new idea.
 */
export function heartsNow(state: HeartState, regenMinutes: number, now: Date): number {
  if (state.hearts >= MAX_HEARTS) {
    return MAX_HEARTS;
  }
  if (!state.heartsUpdatedAt) {
    // Never been docked. Treat as full rather than as "0 with no timestamp",
    // which is what a default-constructed document would otherwise imply.
    return MAX_HEARTS;
  }
  // A non-positive interval would divide by zero or regenerate infinitely.
  // Guarding here rather than trusting config keeps a bad env var from
  // silently disabling the mechanic.
  if (regenMinutes <= 0) {
    return MAX_HEARTS;
  }

  const elapsedMs = now.getTime() - state.heartsUpdatedAt.getTime();
  // A clock that went backwards (NTP correction, or a restored backup) must not
  // *remove* hearts, so negative elapsed time regenerates nothing.
  if (elapsedMs <= 0) {
    return state.hearts;
  }

  const regenerated = Math.floor(elapsedMs / (regenMinutes * 60 * 1000));

  return Math.min(MAX_HEARTS, state.hearts + regenerated);
}

/**
 * When the next heart arrives, or null at full.
 *
 * The client needs this to render "next heart in 12:30" — and it has to be
 * derived from the same arithmetic as `heartsNow`, or the countdown will finish
 * while the count stays put. Returned as an instant rather than a duration so it
 * survives the trip and the client can tick it down locally.
 */
export function nextHeartAt(
  state: HeartState,
  regenMinutes: number,
  now: Date,
): Date | null {
  const current = heartsNow(state, regenMinutes, now);
  if (current >= MAX_HEARTS || !state.heartsUpdatedAt || regenMinutes <= 0) {
    return null;
  }

  const intervalMs = regenMinutes * 60 * 1000;
  const earned = current - state.hearts;
  // The clock does not restart on each heart: the (earned + 1)th interval from
  // the original stamp is when the next one lands. Restarting per heart would
  // let a learner who checked back often regenerate faster than one who did not.
  return new Date(state.heartsUpdatedAt.getTime() + (earned + 1) * intervalMs);
}

/**
 * The write to persist after a heart is spent.
 *
 * Takes the *regenerated* count rather than the stored one, so spending a heart
 * banks whatever had come back in the meantime — otherwise a learner who returned
 * after an hour would lose the regeneration the moment they got one wrong.
 */
export function spendHeart(
  state: HeartState,
  regenMinutes: number,
  now: Date,
): HeartState {
  const current = heartsNow(state, regenMinutes, now);

  return {
    hearts: Math.max(0, current - 1),
    // Always re-stamped, even at 0: the interval to the next heart is measured
    // from the moment of the last loss.
    heartsUpdatedAt: now,
  };
}
