import { useLocalSearchParams, useRouter } from 'expo-router';

import { CheckpointRunner } from '@/components/CheckpointRunner';

/**
 * The end-of-unit test.
 *
 * ## Why this screen is a thin wrapper
 *
 * The body of the screen is the same body that drives the combined test
 * across finished units — same one-shot answer rule, same no-feedback-mid-
 * test policy, same missed-at-submit summary. Both live in
 * `components/CheckpointRunner.tsx` and take a `source` prop, which is
 * what makes the only per-unit-specific thing here the URL parameter and
 * the navigation.
 *
 * ## Why this is not the lesson screen with a flag
 *
 * A lesson shows the right answer the moment you get one wrong — correct
 * for teaching, wrong for a test, because a later question can be about
 * the same item. The server enforces it by sending `correctValue: ''` on
 * mid-test answers, and the answer key only arrives at submit, in
 * `missed`. No audio (hearing the word would give away the gloss), no
 * auto-advance and no hold-to-pause (nothing to time — there is no
 * verdict), and `SessionProgress` gets no `outcomes` so it renders a
 * plain fill rather than pips that never colour in.
 *
 * See `CheckpointRunner` for the actual rendering and the concurrent-
 * mutation handling.
 */
export default function Checkpoint() {
  const { unit } = useLocalSearchParams<{ unit: string }>();
  const router = useRouter();

  return (
    <>
      {/* The runner's BackHandler gates the actual exit mid-test; the
          swipe gesture stays enabled so a learner on the loading skeleton
          or the result page can leave the way they entered. */}
      <CheckpointRunner
        source={{ kind: 'perUnit', unit }}
        onDone={() => router.replace('/')}
      />
    </>
  );
}