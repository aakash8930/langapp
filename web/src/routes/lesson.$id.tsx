import { createFileRoute } from '@tanstack/react-router';

import { fetchLessons, groupByUnit, type Unit } from '../api';
import { LessonQuiz } from '../components/LessonQuiz';
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
  loader: async ({ context }): Promise<{ units: Unit[] }> => {
    const lessons = await context.queryClient.ensureQueryData({
      queryKey: queryKeys.lessons.all,
      queryFn: fetchLessons,
    });
    return { units: groupByUnit(lessons) };
  },
  component: LessonRoute,
});

function LessonRoute() {
  const { id } = Route.useParams();
  const { session } = useSession();
  const { units } = Route.useLoaderData();

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
        <a className="btn btn-primary" href="#/">
          Back to the course
        </a>
      </div>
    </main>
  );
}
