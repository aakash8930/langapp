import { useEffect, useRef } from 'react';

import { burstConfetti } from '../motion';

/**
 * "+N XP", celebrated.
 *
 * ## It only appears where XP is real
 *
 * The number comes from the server every time — `xpAwarded` on
 * `POST /lessons/:id/complete` and on `POST /reviews/:cardId/grade`. Those are
 * the only two responses that carry it.
 *
 * That constraint is worth stating because the obvious place to want this is on
 * every correct quiz answer, and **the answer endpoint returns no XP at all**:
 * its response is `{ exerciseId, correct, selected…, correct…, prompt }` and
 * nothing more. A "+10 XP" there would be a number this component invented,
 * shown to a learner as if the server had said it — and it would be wrong on
 * the first practice repeat, where the award is smaller. `CorrectFlash` is what
 * goes on a correct answer instead: celebration without a fabricated figure.
 *
 * XP is also due-gated on reviews — grading a card that was not actually due
 * awards nothing — so a zero is a real, correct outcome and renders as no
 * badge rather than as "+0 XP".
 */
export function XpBurst({ xp, label }: { xp: number; label?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (xp > 0 && ref.current) burstConfetti(ref.current, { count: 34 });
  }, [xp]);

  if (xp <= 0) return null;

  return (
    <span className="xp-burst" ref={ref} role="status">
      <span className="xp-burst-amount tabular">+{xp}</span>
      <span className="xp-burst-label">{label ?? 'XP'}</span>
    </span>
  );
}

/**
 * The per-answer celebration: a brief green wash and a tick, no number.
 *
 * Deliberately quieter than `XpBurst`. This fires on every correct answer in a
 * lesson — twelve times a run — and anything with confetti in it would be
 * exhausting by the third question and meaningless by the tenth. The loud
 * moment is reserved for finishing.
 *
 * `key`ed by the caller on the exercise id so a new question remounts it and
 * replays the wash; without that, two correct answers in a row would animate
 * once.
 */
export function CorrectFlash() {
  return (
    <span className="correct-flash" aria-hidden="true">
      <span className="correct-flash-tick">✓</span>
    </span>
  );
}
