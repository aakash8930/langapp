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
 * Whether a prompt of this kind has a recording at all.
 *
 * Only vocabulary is voiced. A kanji deliberately gets no audio — it has
 * several readings and which applies depends on the word (山 is やま alone and
 * サン in 火山), so speaking one beside a bare glyph teaches that *that* is how
 * the character reads. Kana would be a recording of a sound the romaji already
 * spells, and a gapped grammar sentence has no single word to say.
 *
 * `wordReading` prompts are vocabulary and do have audio — but see
 * `revealsAnswer` below before offering it.
 */
export function hasAudio(promptKind: string): boolean {
  return promptKind === 'vocab' || promptKind === 'wordReading';
}

/**
 * Whether hearing this prompt would hand the learner the answer.
 *
 * True for `wordReading`, and this is the whole reason the check exists: that
 * question shows a word and asks the learner to type its romaji, so the
 * recording *is* the answer read aloud. Offering play before they answer would
 * turn a transcription exercise into a dictation one — and worse, into a free
 * pass, since the doubled consonant in がっこう is audible.
 *
 * A `vocab` prompt asks what a word means in English, which no amount of
 * listening reveals, so it may be played freely.
 *
 * Same rule the app applies to review cards, where the play button lives on the
 * back of the card: hearing a word before recalling it would answer it.
 */
export function revealsAnswer(promptKind: string): boolean {
  return promptKind === 'wordReading';
}
