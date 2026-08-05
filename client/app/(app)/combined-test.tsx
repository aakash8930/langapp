import { useRouter } from 'expo-router';

import { CheckpointRunner } from '@/components/CheckpointRunner';

/**
 * The combined test: one timed set across every unit the learner has
 * finished.
 *
 * Same screen surface as the per-unit checkpoint (`/checkpoint/:unit`),
 * driven by the same `CheckpointRunner` with a different `source`. The
 * runner chooses the matching API and renders the heading "Combined
 * test" instead of the per-unit label, and the summary lists the units
 * the test covered.
 *
 * ## Why this is the route, not a flag on the per-unit route
 *
 * `/checkpoint/:unit` has `unit` in the URL, and there is no single unit
 * here. A separate path keeps the URL honest and the navigation predictable
 * — the entry card on the home screen routes straight to `/combined-test`,
 * no slug needed.
 */
export default function CombinedTest() {
  const router = useRouter();

  return (
    <CheckpointRunner source={{ kind: 'combined' }} onDone={() => router.replace('/')} />
  );
}