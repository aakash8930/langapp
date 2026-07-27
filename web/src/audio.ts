import { API_BASE } from './api';

/**
 * Where a word's spoken audio lives.
 *
 * A URL builder rather than a fetch: the route is unauthenticated — shared
 * reference content, like `/lessons` — so the browser's own audio element
 * fetches it and gets HTTP caching for free. Pulling the bytes through the
 * authenticated helper would buffer a whole file in JS to hand to a player
 * perfectly capable of fetching it, and would throw the cache away. The server
 * sends `immutable` with a one-year max-age, so each word is fetched once ever.
 *
 * Mirrors `client/api/audio.ts`. Duplicated rather than shared for the same
 * reason the unit labels are: the two apps have separate `node_modules` by
 * design, and a package for one function would cost more than it saves.
 */
export function audioUrlForVocab(vocabId: string): string {
  return `${API_BASE}/content/vocab/${encodeURIComponent(vocabId)}/audio`;
}

/**
 * The same file, reached by a different noun.
 *
 * Kana audio lives at `audio/<item id>.wav` exactly as vocabulary does; the
 * route differs only so a caller asking for a kana does not have to call it a
 * vocab. Kana were missing from the first generation pass on the reasoning that
 * romaji already spells the sound — which is true only for someone who reads
 * romaji, and the first unit exists to stop needing it.
 */
export function audioUrlForKana(kanaId: string): string {
  return `${API_BASE}/content/kana/${encodeURIComponent(kanaId)}/audio`;
}

/**
 * Whether a prompt of this kind has a recording at all.
 *
 * Kana and vocabulary are voiced. Kanji deliberately are not, and that is a
 * content decision rather than a gap: one kanji has several readings and which
 * applies depends on the word (山 is やま alone and サン in 火山), so speaking
 * one beside a bare glyph teaches that *that* is how the character reads. A
 * kana has exactly one reading, which is what makes it safe to speak. A gapped
 * grammar sentence has no single word to say.
 *
 * `wordReading` prompts are vocabulary and do have audio — but see
 * `revealsAnswer` below before offering it.
 */
export function hasAudio(promptKind: string): boolean {
  return promptKind === 'vocab' || promptKind === 'wordReading' || promptKind === 'kana';
}

/**
 * Whether hearing this prompt would hand the learner the answer.
 *
 * True for `wordReading`, and this is the whole reason the check exists: that
 * question shows a word and asks the learner to type its romaji, so the
 * recording *is* the answer read aloud — and the doubled consonant in がっこう
 * is audible.
 *
 * **Also true for `kana`**, which is easy to miss now that kana are voiced. A
 * kana question shows あ and asks which romaji matches; playing it says "a". The
 * options are romaji, so listening does not merely hint, it answers. Audio on a
 * kana question therefore waits for the verdict, where it stops being a hint
 * and becomes the correction.
 *
 * A `vocab` prompt asks what a word means in English, which no amount of
 * listening reveals, so it may be played freely.
 *
 * The study screen is unaffected by all of this — nothing there is graded, so
 * every character can be heard on sight, which is the point of a teach step.
 */
export function revealsAnswer(promptKind: string): boolean {
  return promptKind === 'wordReading' || promptKind === 'kana';
}
