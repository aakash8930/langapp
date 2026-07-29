import { useQuery } from '@tanstack/react-query';

import { API_BASE } from './api';

/**
 * Stroke-order data for one character.
 *
 * `paths` is in **stroke order** and must never be sorted or reordered — that
 * ordering is the entire content of the file. `viewBox` is KanjiVG's
 * `0 0 109 109`.
 */
export type Strokes = { char: string; viewBox: string; paths: string[] };

/** Lowercase hex codepoint, as `GET /content/strokes/:codepoint` expects. */
export function codepointOf(char: string): string | null {
  // `codePointAt` rather than `charCodeAt` so anything outside the BMP would
  // still key correctly, even though nothing in the course is.
  return char.codePointAt(0)?.toString(16).padStart(5, '0') ?? null;
}

/**
 * One shared, cached fetch per character.
 *
 * Both the animated diagram and the tracing canvas need the same paths for the
 * same glyph, and they appear on screen together — so this must be one request,
 * not two. A `staleTime` of Infinity is right rather than lazy: a character's
 * stroke order does not change, which is also why the route serves it with a
 * one-year immutable cache.
 *
 * A character with no data is a **404**, and the intended behaviour is to show
 * the character with no diagram rather than an error. Callers get `isError` and
 * render nothing.
 */
export function useStrokes(char: string) {
  const codepoint = codepointOf(char);

  return useQuery({
    queryKey: ['strokes', char],
    queryFn: async (): Promise<Strokes> => {
      if (!codepoint) throw new Error('Not a character.');
      const response = await fetch(`${API_BASE}/content/strokes/${codepoint}`);
      if (!response.ok) throw new Error('No stroke data for this character.');
      return (await response.json()) as Strokes;
    },
    enabled: codepoint !== null,
    staleTime: Infinity,
    gcTime: Infinity,
    // A 404 is the documented answer for a character nobody drew, not a blip.
    retry: false,
  });
}
