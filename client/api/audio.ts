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
