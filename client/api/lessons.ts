import { api } from './client';
import type { ResolvedItem } from './items';

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

/**
 * A lesson with the items it teaches — what the study screen walks through.
 *
 * The summary above carries only `itemCount`, so until this existed the app had
 * no way to show a learner *what* a lesson contains: home linked straight into
 * the quiz. The website has had this route since it was built; the app simply
 * never asked for it.
 *
 * `examples[].answer` comes back filled in, which is study material rather than
 * a leak — the exercise payload is a separate, allowlisted shape and still
 * carries no answer key.
 */
export type LessonDetail = LessonSummary & { items: ResolvedItem[] };

export function fetchLesson(id: string): Promise<LessonDetail> {
  return api.get<LessonDetail>(`/lessons/${encodeURIComponent(id)}`);
}
