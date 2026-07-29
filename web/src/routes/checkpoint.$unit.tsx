import { createFileRoute } from '@tanstack/react-router';

import { fetchLessons, groupByUnit, type Unit } from '../api';
import { CheckpointQuiz } from '../components/CheckpointQuiz';
import { queryKeys } from '../queryKeys';
import { useSession } from '../useSession';

/**
 * The end-of-unit test.
 *
 * `$unit` is the unit **slug** (`hiragana-basics`) — the same string
 * `Lesson.unit` carries and `Unit.slug` exposes, so a link can be built from
 * the curriculum without a lookup.
 *
 * The loader reads the cached lesson list only to turn that slug into a
 * human-readable label for the heading. It is `ensureQueryData` against the key
 * the home page already populated, so arriving from the curriculum costs no
 * extra fetch, and a cold deep link costs one.
 *
 * Auth-gated. The unit's *content* is public, but a checkpoint is a per-user
 * scored attempt and there is nothing sensible to show a signed-out visitor.
 */
export const Route = createFileRoute('/checkpoint/$unit')({
  loader: async ({ context }): Promise<{ units: Unit[] }> => {
    const lessons = await context.queryClient.ensureQueryData({
      queryKey: queryKeys.lessons.all,
      queryFn: fetchLessons,
    });
    return { units: groupByUnit(lessons) };
  },
  component: CheckpointRoute,
});

function CheckpointRoute() {
  const { unit } = Route.useParams();
  const { session } = useSession();
  const { units } = Route.useLoaderData();

  if (session.state === 'signedIn') {
    // Keyed on the unit so navigating between two checkpoints remounts rather
    // than dropping the second unit's questions into the first one's state.
    return <CheckpointQuiz key={unit} unit={unit} units={units} />;
  }

  if (session.state === 'loading') {
    return (
      <main className="wrap checkpoint-screen">
        <div className="glass panel note" role="status">
          Checking your session…
        </div>
      </main>
    );
  }

  return (
    <main className="wrap checkpoint-screen">
      <div className="glass panel note">
        <strong>Sign in to take the test.</strong>
        <span>
          A checkpoint is scored against your own progress, so it needs an account. Browsing the
          course does not.
        </span>
        <a className="btn btn-primary" href="#/">
          Back to the course
        </a>
      </div>
    </main>
  );
}
