import { api } from './client';

/**
 * Mirrors LessonSummary in api/src/content/dto/lesson-response.dto.ts.
 *
 * There is no `locked` or `completed` here — the server does not compute lock
 * state. See lib/lessons.ts.
 */
export type LessonSummary = {
  id: string;
  lang: 'ja';
  unit: string;
  order: number;
  title: string;
  exerciseTypes: string[];
  itemCount: number;
  prerequisiteLessonIds: string[];
};

/**
 * Unauthenticated on the server, but the client only ever asks while signed in.
 *
 * Omitting `unit` returns every unit, which is what the home screen wants: one
 * request, and — because the whole set is present — a katakana lesson locked
 * behind a hiragana one can name the lesson that opens it. Asking per unit
 * would leave that prerequisite unresolvable.
 */
export function fetchLessons(unit?: string): Promise<LessonSummary[]> {
  return api.get<LessonSummary[]>(
    unit ? `/lessons?unit=${encodeURIComponent(unit)}` : '/lessons',
  );
}
