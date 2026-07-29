import { createFileRoute } from '@tanstack/react-router';

import { fetchLessons, groupByUnit, type Unit } from '../api';
import { LessonQuiz } from '../components/LessonQuiz';
import { useSession } from '../useSession';

/**
 * The teach step.
 *
 * Renders a lesson by id. The component keys on `route.id` so finishing a
 * lesson and navigating to the next one remounts the quiz with fresh state —
 * without that, the new lesson's questions would mount on top of the previous
 * lesson's.
 *
 * Loader fetches units (public) so `LessonQuiz` can resolve the "next lesson
 * after this one" question on completion — a route that has nowhere to send
 * the learner is broken.
 *
 * Auth-gated: signing in is a prerequisite to taking a quiz (the lesson
 * content itself is unauthenticated, but grading is per-user).
 */
export const Route = createFileRoute('/lesson/$id')({
  loader: async (): Promise<{ units: Unit[] }> => {
    const lessons = await fetchLessons();
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
        <a className="button" href="#/">
          Back to the course
        </a>
      </div>
    </main>
  );
}
