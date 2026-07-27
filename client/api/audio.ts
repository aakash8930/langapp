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
 * Whether a prompt of this kind has a recording at all.
 *
 * Only vocabulary is voiced. A kanji deliberately gets none — it has several
 * readings and which applies depends on the word (山 is やま alone and サン in
 * 火山), so speaking one beside a bare glyph teaches that *that* is how the
 * character reads. Kana would voice a sound the romaji already spells, and a
 * gapped grammar sentence has no single word to say.
 *
 * `wordReading` prompts are vocabulary and do have audio — but see
 * `revealsAnswer` before offering it.
 *
 * Mirrors `web/src/audio.ts`. Same names on both surfaces on purpose: the rule
 * is the same rule, and two spellings of it would be two places to change.
 */
export function hasAudio(promptKind: string): boolean {
  return promptKind === 'vocab' || promptKind === 'wordReading';
}

/**
 * Whether hearing this prompt would hand over the answer.
 *
 * True for `wordReading`: that question shows a word and asks the learner to
 * type its romaji, so the recording *is* the answer read aloud — and the
 * doubled consonant in がっこう is audible, which is precisely the thing the
 * lesson is testing. Offering play before the answer turns a transcription
 * exercise into dictation.
 *
 * A `vocab` prompt asks what a word means in English, which listening does not
 * reveal, so it plays freely.
 */
export function revealsAnswer(promptKind: string): boolean {
  return promptKind === 'wordReading';
}
