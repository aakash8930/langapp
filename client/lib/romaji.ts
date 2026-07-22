/**
 * When to show romaji.
 *
 * Up to and including N4, always. From N3 on, never — by then reading kana is
 * the skill being exercised, and latin script beside it is a crutch nobody
 * drops on their own. The cutoff is a product decision, not a data one, which
 * is why the API stores romaji regardless and each surface decides.
 *
 * Duplicated in `web/src/romaji.ts`. Six lines and no build coupling beats a
 * shared package between two projects that deliberately keep separate
 * `node_modules`.
 */
const SHOWN_UP_TO: readonly string[] = ['N5', 'N4'];

export function showsRomaji(jlpt: string | undefined): boolean {
  return jlpt !== undefined && SHOWN_UP_TO.includes(jlpt);
}
