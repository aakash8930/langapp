import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';

import {
  answerCheckpoint,
  startCheckpoint,
  submitCheckpoint,
  type CheckpointQuestion,
  type CheckpointResult,
  type CheckpointSet,
  type Unit,
} from '../api';
import { burstConfetti, countUpNow } from '../motion';
import { queryKeys } from '../queryKeys';
import { goBack } from '../useRoute';

/**
 * The end-of-unit test.
 *
 * ## Why this is not `LessonQuiz` with a flag
 *
 * They look alike and behave oppositely, and every difference is one a shared
 * component would have to branch on:
 *
 *  - **No verdict panel.** A lesson shows the right answer the moment you get
 *    one wrong, which is the correct thing for teaching and wrong for a test —
 *    later questions can be about the same item. The server enforces this by
 *    sending `correctValue: ''`, so there is nothing to render even if we
 *    wanted to.
 *  - **No re-asking and no run-broken banner.** A lesson run can be abandoned
 *    and restarted freely; a checkpoint attempt cannot be re-rolled, so telling
 *    someone their run is spoiled would be telling them to give up on a test
 *    they cannot retake until they submit it.
 *  - **Answers are fire-and-forget.** The screen advances on click and the POST
 *    settles behind it, the same trade `Review` makes: twenty questions must
 *    not feel like twenty round trips. A lesson has to wait, because the
 *    verdict *is* the response.
 *
 * ## The one thing that must not be reimplemented here
 *
 * `passMark` comes from the server on every set and result. It is not 0.8 in
 * this file. If the bar moves, a client with its own copy of it starts telling
 * learners they passed when they did not.
 */
export function CheckpointQuiz({ unit, units }: { unit: string; units: Unit[] }) {
  const queryClient = useQueryClient();
  const label = units.find((u) => u.slug === unit)?.label ?? unit;

  const [phase, setPhase] = useState<Phase>({ name: 'loading' });
  const [busy, setBusy] = useState(false);

  /**
   * When the current question went on screen, for `responseTimeMs`.
   *
   * A ref rather than state: it is read once per answer and never rendered, so
   * putting it in state would re-render the card on every question for nothing.
   */
  const shownAt = useRef<number>(Date.now());

  /**
   * Answers still in flight. Submitting before they land would score the
   * attempt without them — the server counts unanswered questions as wrong, so
   * a lost race reads as a failed question rather than a missing one.
   */
  const pending = useRef<Set<Promise<unknown>>>(new Set());

  /** Answers whose POST failed outright, so the summary can be honest about it. */
  const [lost, setLost] = useState(0);

  useEffect(() => {
    let cancelled = false;

    startCheckpoint(unit)
      .then((set) => {
        if (cancelled) return;
        shownAt.current = Date.now();
        setPhase(
          set.questions.length === 0
            ? { name: 'error', message: 'This unit has nothing to test yet.' }
            : { name: 'asking', set, index: 0, answered: 0 },
        );
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPhase({ name: 'error', message: messageFor(err) });
      });

    return () => {
      cancelled = true;
    };
  }, [unit]);

  const finish = useCallback(
    async (set: CheckpointSet) => {
      setPhase({ name: 'submitting', set });

      // Let every in-flight answer land first. `allSettled`, not `all`: one
      // failed POST must not stop the submit — the attempt exists server-side
      // either way and the learner is owed their score.
      await Promise.allSettled([...pending.current]);

      try {
        const result = await submitCheckpoint(unit, set.attempt);
        setPhase({ name: 'done', set, result });

        // XP and streak can move on a pass, and the header
        // reads them from `/me/progress`.
        void queryClient.invalidateQueries({ queryKey: queryKeys.session.progress });
      } catch (err) {
        setPhase({ name: 'error', message: messageFor(err) });
      }
    },
    [queryClient, unit],
  );

  function answer(question: CheckpointQuestion, body: { optionId: string } | { text: string }) {
    if (phase.name !== 'asking' || busy) return;

    const elapsed = Date.now() - shownAt.current;
    const request = answerCheckpoint(unit, phase.set.attempt, question.exerciseId, {
      ...body,
      // Guard against a tab left open overnight: a 9-hour "answer time" would
      // poison the learner's speed baseline for that item permanently.
      ...(elapsed <= MAX_PLAUSIBLE_MS ? { responseTimeMs: elapsed } : {}),
    }).catch(() => {
      setLost((n) => n + 1);
    });

    pending.current.add(request);
    void request.finally(() => pending.current.delete(request));

    const nextIndex = phase.index + 1;
    shownAt.current = Date.now();

    if (nextIndex >= phase.set.questions.length) {
      setBusy(true);
      void finish(phase.set).finally(() => setBusy(false));
      return;
    }

    setPhase({ ...phase, index: nextIndex, answered: phase.answered + 1 });
  }

  if (phase.name === 'loading') {
    return (
      <main className="wrap checkpoint-screen">
        <div className="glass panel note" role="status">
          Setting your test…
        </div>
      </main>
    );
  }

  if (phase.name === 'error') {
    return (
      <main className="wrap checkpoint-screen">
        <div className="glass panel note note-error" role="alert">
          <strong>Can’t run the test.</strong>
          <span>{phase.message}</span>
          <button className="btn btn-primary" type="button" onClick={goBack}>
            Back to the course
          </button>
        </div>
      </main>
    );
  }

  if (phase.name === 'submitting') {
    return (
      <main className="wrap checkpoint-screen">
        <div className="glass panel note" role="status">
          Marking your test…
        </div>
      </main>
    );
  }

  if (phase.name === 'done') {
    return (
      <main className="wrap checkpoint-screen">
        <Summary result={phase.result} label={label} lost={lost} />
      </main>
    );
  }

  const question = phase.set.questions[phase.index];
  const total = phase.set.questions.length;
  const isLast = phase.index === total - 1;

  return (
    <main className="wrap checkpoint-screen">
      <div className="quiz">
        <div className="quiz-head">
          <button className="link-button" type="button" onClick={goBack}>
            ← Leave
          </button>
          <span className="quiz-count tabular">
            {phase.index + 1} / {total}
          </span>
        </div>

        {/*
          A plain progress bar, not the lesson's per-question pips.

          Pips carry right/wrong per question, and this screen deliberately does
          not know which — the server withholds the verdict until submit. Drawing
          grey pips that never colour in would look broken; "how far through am
          I" is the only question this screen can honestly answer.
        */}
        <div
          className="quiz-progress checkpoint-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={phase.index}
          aria-label="Test progress"
        >
          <span style={{ width: `${(phase.index / total) * 100}%` }} />
        </div>

        <p className="checkpoint-note" role="note">
          One answer each — you can’t change it, and you’ll see how you did at the end.
        </p>

        <div className="glass panel quiz-card">
          <p className={`quiz-prompt ja quiz-prompt-${question.promptKind}`}>{question.prompt}</p>
          <p className="quiz-question">{question.question}</p>

          {/*
            No audio button anywhere on this screen, including for `vocab`
            prompts where a lesson plays it freely.

            The lesson's rule is "audio unless it reveals the answer". Here the
            stricter rule is simply that a test should measure what the learner
            knows, and a `vocab` prompt read aloud is a hint on the recall of the
            written form even though it does not speak the gloss. If this is ever
            relaxed, it is a pedagogical decision, not a UI one.
          */}

          {question.type === 'wordReading' ? (
            <TypedAnswer
              key={question.exerciseId}
              disabled={busy}
              onSubmit={(text) => answer(question, { text })}
            />
          ) : question.options && question.options.length > 0 ? (
            <div className="options">
              {question.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="option"
                  onClick={() => answer(question, { optionId: option.id })}
                  disabled={busy}
                >
                  {option.value}
                </button>
              ))}
            </div>
          ) : (
            <p className="note-error" role="alert">
              This question needs a newer version of the site to answer.
            </p>
          )}
        </div>

        {isLast ? (
          <p className="checkpoint-last" role="status">
            Last one — answering finishes the test.
          </p>
        ) : null}
      </div>
    </main>
  );
}

/**
 * Beyond this, the elapsed time is not a measurement of anything.
 *
 * The learner walked away, the laptop slept, the tab sat in the background. A
 * value like that would enter the item's running mean and stay there — the
 * stats are cumulative, so one bad sample is not washed out by later good ones
 * for a very long time. Omitting the field is honest; the server treats absent
 * as "no sample" rather than as zero.
 */
const MAX_PLAUSIBLE_MS = 5 * 60 * 1000;

type Phase =
  | { name: 'loading' }
  | { name: 'error'; message: string }
  | { name: 'asking'; set: CheckpointSet; index: number; answered: number }
  | { name: 'submitting'; set: CheckpointSet }
  | { name: 'done'; set: CheckpointSet; result: CheckpointResult };

function Summary({
  result,
  label,
  lost,
}: {
  result: CheckpointResult;
  label: string;
  lost: number;
}) {
  const scoreRef = useRef<HTMLElement>(null);
  const percent = Math.round(result.score * 100);

  useEffect(() => {
    if (scoreRef.current) countUpNow(scoreRef.current, percent);
    // Only on a pass. Confetti over a failed test would read as mockery.
    if (result.passed && scoreRef.current) burstConfetti(scoreRef.current, { count: 54 });
  }, [percent, result.passed]);

  return (
    <div className="glass panel quiz-summary checkpoint-summary">
      <h2>{result.passed ? `${label} — passed` : `${label} — not yet`}</h2>

      <p className={result.passed ? 'clean-run' : 'summary-note'}>
        <span className="tabular accent checkpoint-score" ref={scoreRef}>
          {percent}
        </span>
        <span className="checkpoint-score-unit">%</span>
        <span className="checkpoint-score-detail">
          {result.correctCount} of {result.questionCount} right — you needed{' '}
          {Math.round(result.passMark * 100)}%.
        </span>
      </p>

      <dl className="summary-rows">
        {result.xpAwarded > 0 ? (
          <div>
            <dt>XP earned</dt>
            <dd className="tabular accent">+{result.xpAwarded}</dd>
          </div>
        ) : null}
      </dl>

      {lost > 0 ? (
        <p className="note-error" role="alert">
          {lost} {lost === 1 ? 'answer' : 'answers'} didn’t reach the server and{' '}
          {lost === 1 ? 'was' : 'were'} marked wrong. That’s a connection problem, not your
          result — the test is worth retaking.
        </p>
      ) : null}

      {result.missed.length > 0 ? (
        <>
          <p className="verdict-remember-kicker">What to remember</p>
          <ul className="missed">
            {result.missed.map((miss) => (
              <li key={miss.itemId}>
                <span className="ja missed-prompt">{miss.prompt}</span>
                <span className="missed-answer">
                  {miss.answered ? '' : 'not answered — '}
                  {miss.correctValue}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <div className="summary-actions">
        <button className="btn btn-primary" type="button" onClick={goBack}>
          Back to the course
        </button>
        {result.passed ? null : <span className="summary-note">Study the missed answers above, then retake when ready.</span>}
      </div>
    </div>
  );
}

/**
 * The typed-answer field, for units that teach っ and ー.
 *
 * Deliberately not shared with the lesson's `WordReadingInput`: that one clears
 * and re-enables around a verdict, and there is no verdict here. Trying to make
 * one component do both would mean a `showsVerdict` prop threaded through every
 * branch of it.
 */
function TypedAnswer({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (text.trim().length === 0) return;
    onSubmit(text);
    setText('');
  }

  return (
    <form className="typing" onSubmit={handleSubmit}>
      <input
        autoFocus
        className="typing-input"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="rōmaji"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        disabled={disabled}
        aria-label="Type the reading in rōmaji"
      />
      <button className="btn btn-primary" type="submit" disabled={disabled || text.trim().length === 0}>
        Answer
      </button>
    </form>
  );
}

/**
 * The API runs on a laptop that sleeps, so "offline" is a normal condition and
 * the copy says what to do rather than "something went wrong".
 */
function messageFor(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return 'The server isn’t reachable right now. Try again in a moment.';
  }
  return message;
}
