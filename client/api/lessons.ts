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

/** Unauthenticated on the server, but the client only ever asks while signed in. */
export function fetchLessons(unit: string): Promise<LessonSummary[]> {
  return api.get<LessonSummary[]>(`/lessons?unit=${encodeURIComponent(unit)}`);
}
