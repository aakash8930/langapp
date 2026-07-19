/**
 * Levels aren't specified anywhere in the blueprint, so this is the most boring
 * curve that works: a flat 100 XP per level, starting at level 1.
 *
 * Deliberately linear — a compounding curve is a product/retention decision
 * that wants real usage data behind it, and this is trivial to swap because
 * nothing persists a level. It's derived from XP on every read.
 */
export const XP_PER_LEVEL = 100;

export interface LevelProgress {
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
}

export function levelFromXp(xp: number): LevelProgress {
  const safeXp = Math.max(0, Math.floor(xp));

  return {
    level: Math.floor(safeXp / XP_PER_LEVEL) + 1,
    xpIntoLevel: safeXp % XP_PER_LEVEL,
    xpForNextLevel: XP_PER_LEVEL,
  };
}
