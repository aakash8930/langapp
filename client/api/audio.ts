/**
 * Where a word's spoken audio lives.
 *
 * A URL builder rather than a fetch: the route is unauthenticated, so
 * `expo-audio` fetches it directly and gets HTTP caching for free. Pulling the
 * bytes through `apiFetch` would buffer a whole file in JS to hand to a player
 * that is perfectly capable of fetching it, and would throw the cache away — the
 * server sends `immutable` with a one-year max-age, so each word is fetched once
 * ever.
 *
 * Built from the same `EXPO_PUBLIC_API_URL` the rest of the client uses, so a
 * funnel hostname change moves the audio with everything else.
 */
const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

export function audioUrlForVocab(vocabId: string): string {
  return `${BASE_URL}/content/vocab/${encodeURIComponent(vocabId)}/audio`;
}

/**
 * The same file, reached by a different noun.
 *
 * Kana audio is stored at `audio/<item id>.wav` exactly as vocabulary is, so
 * these two routes differ only in what the caller calls the thing. Keeping them
 * separate rather than collapsing to one generic route means a kana is never
 * asked for as a vocab, which would be a small lie for the next reader to
 * untangle.
 */
export function audioUrlForKana(kanaId: string): string {
  return `${BASE_URL}/content/kana/${encodeURIComponent(kanaId)}/audio`;
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
