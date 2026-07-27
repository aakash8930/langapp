/**
 * Where a character's stroke-order outlines live.
 *
 * A URL builder rather than a fetch, for the same reason as the audio: the
 * route is unauthenticated shared reference content, so the response can be
 * fetched directly and cached by the platform. The server sends `immutable`
 * with a one-year max-age — a character's stroke order does not change — so
 * each character is fetched once, ever.
 *
 * Keyed by the character's own codepoint, so nothing has to be looked up: き is
 * taught both alone and inside きゃ, and 山 is both a kanji entry and part of
 * words, and all of them resolve to the same file.
 *
 * **Padded to five digits.** KanjiVG names its files that way, so あ (U+3042)
 * is `03042`. The API pads too and accepts either form — that leniency exists
 * because the unpadded version was what shipped broken first. Padding here as
 * well means the client does not depend on the server's forgiveness.
 */
const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

export function strokesUrlForChar(char: string): string {
  const codepoint = (char.codePointAt(0) ?? 0).toString(16).padStart(5, '0');
  return `${BASE_URL}/content/strokes/${codepoint}`;
}

/**
 * Whether a character is one this course draws strokes for.
 *
 * Only the kinds that are a single character to be *written*. A vocabulary word
 * is several characters and a grammar point is a sentence — neither is learned
 * as a unit to write, and stacking five diagrams under a word buries the word.
 */
export function kindHasStrokes(kind: string): boolean {
  return kind === 'kana' || kind === 'kanji';
}
