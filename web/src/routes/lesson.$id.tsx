import { createFileRoute, Link } from '@tanstack/react-router';

import { fetchLessons, groupByUnit, type Unit } from '../api';
import { LessonQuiz } from '../components/LessonQuiz';
import { log, logError } from '../debug';
import { queryKeys } from '../queryKeys';
import { useSession } from '../useSession';

/**
 * The teach step.
 *
 * Renders a lesson by id. The component keys on `route.id` so finishing a
 * lesson and navigating to the next one remounts the quiz with fresh state —
 * without that, the new lesson's questions would mount on top of the previous
 * lesson's.
 *
 * Loader reads the cached lesson list so `LessonQuiz` can resolve "next lesson
 * after this" on completion — a route that has nowhere to send the learner is
 * broken. Same `ensureQueryData` call the home page uses, so a back-navigation
 * to `/` between attempts does not produce a redundant fetch.
 *
 * Auth-gated: signing in is a prerequisite to taking a quiz (the lesson
 * content itself is unauthenticated, but grading is per-user).
 */
export const Route = createFileRoute('/lesson/$id')({
  loader: async ({ context, params }): Promise<{ units: Unit[] }> => {
    const lessons = await context.queryClient.ensureQueryData({
      queryKey: queryKeys.lessons.all,
      queryFn: fetchLessons,
    });
    const units = groupByUnit(lessons);

    // The route resolves whether or not `:id` names a real lesson — the loader
    // fetches the *list*, not this lesson — so a bad id gets a mounted quiz that
    // fails later and further from the cause. Named here instead.
    const known = units.flatMap((unit) => unit.lessons).some((lesson) => lesson.id === params.id);
    if (known) log('route', `lesson loader: ${params.id} is in the catalog`);
    else
      logError('route', `lesson loader: no lesson ${params.id} in the catalog`, {
        id: params.id,
        lessonCount: units.reduce((n, unit) => n + unit.lessons.length, 0),
      });

    return { units };
  },
  component: LessonRoute,
});

function LessonRoute() {
  const { id } = Route.useParams();
  const { session } = useSession();
  const { units } = Route.useLoaderData();

  // Which of the three branches below rendered. "I clicked into a lesson and got
  // a sign-in card" reads as a bug when the session is merely still loading.
  log('route', `lesson ${id}: session is ${session.state}`);

  if (session.state === 'signedIn') {
    return (
      <LessonQuiz
        key={id}
        lessonId={id}
        units={units}
        completedLessonIds={session.progress?.completedLessonIds ?? null}
        audioSpeed={session.user.settings.audioSpeed}
        onFinished={() => {
          /*
           * Task #11 wires the lesson end to a query cache invalidation. For
           * now, this is a no-op — the next navigation re-fetches anyway.
           */
        }}
      />
    );
  }

  if (session.state === 'loading') {
    return (
      <main className="wrap lesson-screen">
        <div className="glass panel note" role="status">
          Checking your session…
        </div>
      </main>
    );
  }

  return (
    <main className="wrap lesson-screen">
      <div className="glass panel note">
        <strong>Sign in to take this lesson.</strong>
        <span>Quizzes and progress need an account; browsing the course does not.</span>
        <Link className="btn btn-primary" to="/">
          Back to the course
        </Link>
      </div>
    </main>
  );
}
