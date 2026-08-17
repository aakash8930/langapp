import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';

import {
  answerExercise,
  completeLesson,
  fetchExercises,
  newAttempt,
  nextLessonAfter,
  type AnswerResult,
  type CompleteResult,
  type ExerciseSet,
  type LessonSummary,
  type MultipleChoiceQuestion,
  type Unit,
  type WordReadingQuestion,
  type SpeechQuestion,
} from '../api';
import { hasAudio, revealsAnswer } from '../audio';
import { log, logError } from '../debug';
import { burstConfetti, countUpNow } from '../motion';
import { queryKeys } from '../queryKeys';
import { SpeakButton } from './SpeakButton';
import { SpeechQuiz } from './SpeechQuiz';
// Only the flash: the lesson summary already celebrates its XP with the
// count-up and the confetti burst, and stacking `XpBurst` on top would show the
// same number twice.
import { CorrectFlash } from './XpBurst';
import { go, goBack } from '../useRoute';

/**
 * How long a verdict stays on screen before the quiz moves itself along.
 *
 * A right answer needs only long enough to register as right, and the first
 * pass was too generous — 850ms reads as waiting when you already know you were
 * correct. A wrong one has to be *read*: it is the only place the correct answer
 * is shown, and for grammar it is a whole sentence, so it keeps six times the
 * budget.
 *
 * Both are escapable in both directions: the button advances immediately, and
 * hovering or focusing the verdict holds it open indefinitely. That pause is
 * not a flourish — an auto-advancing screen with no way to stop it fails WCAG
 * 2.2.1, and "read faster" is not an accessibility strategy.
 */
const CORRECT_MS = 400;
const WRONG_MS = 2400;

/** How long the end-of-lesson summary sits before it moves on by itself. */
const NEXT_MS = 4200;

/**
 * What happens when this lesson is finished cleanly.
 *
 * The rule is uniform, and deliberately does not branch on whether this run was
 * a first completion or practice: look at the next lesson in teaching order and
 * ask whether it has been learned. Practice chains straight into more practice;
 * unlearned material sends the learner back to the curriculum to read it first,
 * because a quiz on something never taught is just a guessing game.
 */
type NextStep =
  | { kind: 'practise'; lesson: LessonSummary }
  | { kind: 'learn'; lesson: LessonSummary }
  | { kind: 'courseComplete' }
  /**
   * The curriculum list has not loaded (or failed), so what follows this lesson
   * is genuinely unknown. Distinct from `courseComplete` because an empty list
   * and a finished course look identical to `nextLessonAfter`, and telling
   * someone on lesson three that they have finished the course is worse than
   * saying nothing.
   */
  | { kind: 'unknown' };

type Phase =
  | { name: 'loading' }
  | { name: 'error'; message: string }
  /**
   * A straight walk through the questions — `index` only ever moves forward.
   *
   * This replaced a queue that re-asked a wrong question until it was answered
   * right. Re-asking made every finished run clean by construction, which meant
   * the lesson could never actually be failed; the cost of a mistake was a few
   * seconds. Now a mistake costs the lesson, and the run has to be repeated.
   * `answered` is what that verdict is computed from.
   */
  | {
      name: 'asking';
      set: ExerciseSet;
      index: number;
      answered: AnswerResult[];
      result: AnswerResult | null;
    }
  | { name: 'finishing'; set: ExerciseSet }
  /** Reached the end with at least one wrong. The lesson is not complete. */
  | { name: 'retry'; set: ExerciseSet; answered: AnswerResult[] }
  | {
      name: 'done';
      set: ExerciseSet;
      summary: CompleteResult;
      answered: AnswerResult[];
      next: NextStep;
      /**
       * Set when this completion finished a whole unit, so the summary can
       * offer its checkpoint. Kept beside `next` rather than folded into it:
       * the test is not what comes *next* in the course — the learner can skip
       * it and carry straight on — it is an offer made at the one moment it
       * makes sense.
       */
      finishedUnit: Unit | null;
    };

/**
 * One run through a lesson.
 *
 * Answering is a **round trip** — the exercise payload carries no answer key, by
 * design, so the server is the only thing that knows. That is why an option
 * shows a pending state rather than colouring immediately.
 *
 * **A lesson is pass-or-repeat.** Every question is asked exactly once; getting
 * one wrong does not stop the run, it fails it. That mirrors the server, whose
 * completion gate looks for an attempt with every question answered correctly —
 * so a run with a mistake in it would be refused by `/complete` anyway. Rather
 * than send a request we know will 409, the screen reads the same rule off the
 * answers it already has.
 *
 * The consequence worth knowing: a messy practice run earns **no** XP, where
 * before the re-ask loop guaranteed everyone eventually earned some.
 */
export function LessonQuiz({
  lessonId,
  units,
  completedLessonIds,
  audioSpeed,
  onFinished,
}: {
  lessonId: string;
  units: Unit[];
  /** Null while progress is still loading, or when signed out. */
  completedLessonIds: string[] | null;
  audioSpeed: number;
  onFinished: () => void;
}) {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>({ name: 'loading' });
  const [busy, setBusy] = useState(false);
  /** Bumped by "Run it again" to redraw a fresh attempt of the same lesson. */
  const [run, setRun] = useState(0);
  /** True while the pointer or focus is on the verdict — holds the timer open. */
  const [held, setHeld] = useState(false);

  // Drawn once per run, kept in state so a TanStack Query cache hit does not
  // flip the seed under our feet. Re-drawing mid-lesson would reshuffle the
  // questions and invalidate the exerciseIds already on screen.
  const [attempt, setAttempt] = useState(() => newAttempt());

  /*
   * Redraw the attempt when `run` changes — and *only* then.
   *
   * An unguarded effect on `[run]` also fires on mount, which drew a second
   * attempt immediately: two exercise sets were fetched, the screen showed one
   * and answered against the other, and when the second landed it reset the
   * phase and wiped the verdict. The symptom was that answering a question
   * showed no feedback whatsoever.
   *
   * The ref is the guard. It cannot be `useState`, because the check has to see
   * the previous value during the same commit that changes it.
   */
  const drawnForRun = useRef(run);
  useEffect(() => {
    if (drawnForRun.current === run) return;
    drawnForRun.current = run;
    setAttempt(newAttempt());
  }, [run]);

  const exerciseQuery = useQuery({
    queryKey: queryKeys.lessons.exercises(lessonId, attempt),
    queryFn: () => fetchExercises(lessonId, attempt),
    // Bumping `run` to redo the lesson should drop the cached attempt and
    // start fresh — the new attempt key produces a new cache entry, but the
    // old one is left behind as harmless garbage that `gcTime` reaps.
    staleTime: 5 * 60_000,
  });

  /**
   * Which `(lesson, attempt)` the phase machine is currently walking.
   *
   * The effect below restarts the walk when the data arrives, and a refetch
   * hands back a *new object* for the *same* attempt — on a window focus, say.
   * Keyed on the object identity, that would silently restart a lesson someone
   * was halfway through. Keyed on the pair that actually identifies a question
   * set, it does not.
   */
  const walking = useRef<string | null>(null);

  // Translate the query state into the phase machine. The query owns the
  // fetch; the phase owns the walk through the questions. This split lets the
  // phase machine stay simple while the cache, retries and cancellation are
  // TanStack Query's problem.
  useEffect(() => {
    if (exerciseQuery.isPending) {
      setPhase({ name: 'loading' });
      return;
    }
    if (exerciseQuery.isError) {
      logError('quiz', `could not load exercises for ${lessonId} attempt ${attempt}`, {
        error: exerciseQuery.error,
      });
      setPhase({
        name: 'error',
        message:
          exerciseQuery.error instanceof Error
            ? exerciseQuery.error.message
            : 'Could not load this lesson.',
      });
      return;
    }
    if (exerciseQuery.data) {
      const key = `${lessonId}:${attempt}`;
      if (walking.current === key) {
        // Not a problem — this is the refetch guard doing its job. Logged
        // because the alternative reading of "the quiz did not restart" is a
        // broken restart, and the two are otherwise identical on screen.
        log('quiz', `already walking ${key} — refetch ignored`);
        return;
      }
      walking.current = key;
      log('quiz', `starting ${key}`, {
        questionCount: exerciseQuery.data.questionCount,
        promptKinds: [...new Set(exerciseQuery.data.questions.map((q) => q.promptKind))],
      });
      setPhase({ name: 'asking', set: exerciseQuery.data, index: 0, answered: [], result: null });
    }
  }, [
    exerciseQuery.data,
    exerciseQuery.isPending,
    exerciseQuery.isError,
    exerciseQuery.error,
    lessonId,
    attempt,
  ]);

  /*
   * The `/complete` mutation. Its `onSuccess` invalidates progress so the
   * header's XP / streak / completed-lesson list is fresh by the time the
   * "Done" summary hands the learner back to the course catalog. The
   * `completedLessonIds` invalidate is what closes the loop — without it,
   * the row they just finished would still read "○" empty until a full
   * refetch.
   */
  const completeLessonMutation = useMutation({
    mutationFn: () => completeLesson(lessonId),
  });

  /**
   * Guards against the auto-advance timer and a click landing in the same tick.
   * A ref rather than state because the second caller has to see the flag
   * before React has re-rendered anything.
   */
  const advancing = useRef(false);

  const advance = useCallback(async () => {
    if (phase.name !== 'asking' || phase.result === null) return;
    if (advancing.current) return;
    advancing.current = true;

    try {
      const answered = [...phase.answered, phase.result];
      const nextIndex = phase.index + 1;

      if (nextIndex < phase.set.questions.length) {
        setPhase({ ...phase, index: nextIndex, answered, result: null });
        return;
      }

      // End of the lesson. A single wrong answer means it was not passed, and
      // `/complete` would refuse it — so we do not ask.
      if (answered.some((result) => !result.correct)) {
        log('quiz', 'run failed — offering a restart, /complete not called', {
          wrong: answered.filter((result) => !result.correct).length,
          of: answered.length,
        });
        setPhase({ name: 'retry', set: phase.set, answered });
        return;
      }

      log('quiz', `clean run of ${lessonId} — calling /complete`, { answered: answered.length });
      setPhase({ name: 'finishing', set: phase.set });
      try {
        const summary = await completeLessonMutation.mutateAsync();
        await queryClient.invalidateQueries({ queryKey: queryKeys.session.progress });
        setPhase({
          name: 'done',
          set: phase.set,
          summary,
          answered,
          next: stepAfter(units, completedLessonIds, lessonId),
          // Only on a genuine first completion. Without this, practising any
          // lesson in a long-finished unit re-offers its test every time — and
          // silently disables the summary's auto-advance along with it, which
          // is a behaviour change to repeat practice nobody asked for.
          finishedUnit: summary.firstCompletion
            ? unitFinishedBy(units, completedLessonIds, lessonId)
            : null,
        });
        onFinished();
      } catch (error) {
        // A 409 here is the server's two preconditions refusing — prerequisites
        // unmet, or no clean attempt on record. Worth distinguishing from a
        // network failure, which the status in the `api` line above does.
        logError('quiz', `/complete refused ${lessonId}`, error);
        setPhase({
          name: 'error',
          message: error instanceof Error ? error.message : 'Could not save this lesson.',
        });
      }
    } finally {
      advancing.current = false;
    }
  }, [phase, lessonId, units, completedLessonIds, onFinished, completeLessonMutation, queryClient]);

  // Auto-advance past a verdict. Held open while the learner is reading it.
  useEffect(() => {
    if (phase.name !== 'asking' || phase.result === null || held) return;

    const timer = window.setTimeout(
      () => void advance(),
      phase.result.correct ? CORRECT_MS : WRONG_MS,
    );
    return () => window.clearTimeout(timer);
  }, [phase, held, advance]);

  // Auto-advance off the summary into whatever comes next.
  //
  // **Not when a checkpoint is on offer.** Everything else this timer moves
  // into is more of the same — the next lesson, or the curriculum. A test is
  // not: it is scored, one shot per question, and the attempt it opens stays
  // open. Sliding someone into that because they read the summary too slowly
  // would be the screen making the decision for them.
  useEffect(() => {
    if (phase.name !== 'done' || held || phase.finishedUnit) return;

    const step = phase.next;
    const timer = window.setTimeout(() => goToStep(step), NEXT_MS);
    return () => window.clearTimeout(timer);
  }, [phase, held]);

  async function chooseMultipleChoice(question: MultipleChoiceQuestion, optionId: string) {
    if (phase.name !== 'asking' || phase.result || busy) return;

    setBusy(true);
    try {
      const result = await answerExercise(lessonId, question.exerciseId, { optionId });
      setPhase({ ...phase, result });
    } catch (error) {
      setPhase({
        name: 'error',
        message: error instanceof Error ? error.message : 'Could not check that answer.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function submitWordReading(question: WordReadingQuestion, text: string) {
    if (phase.name !== 'asking' || phase.result || busy) return;
    // Empty submissions are a foot-gun: a learner who hits Enter on an empty
    // input would land on a wrong-answer screen with no idea why. The submit
    // button is disabled while the input is empty, so this is a guard against
    // direct key handling.
    if (text.trim().length === 0) return;

    setBusy(true);
    try {
      const result = await answerExercise(lessonId, question.exerciseId, { text });
      setPhase({ ...phase, result });
    } catch (error) {
      setPhase({
        name: 'error',
        message: error instanceof Error ? error.message : 'Could not check that answer.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function submitSpeech(question: SpeechQuestion, text: string) {
    if (phase.name !== 'asking' || phase.result || busy) return;

    setBusy(true);
    try {
      const result = await answerExercise(lessonId, question.exerciseId, { text });
      setPhase({ ...phase, result });
    } catch (error) {
      setPhase({
        name: 'error',
        message: error instanceof Error ? error.message : 'Could not check that answer.',
      });
    } finally {
      setBusy(false);
    }
  }

  if (phase.name === 'loading') {
    return (
      <div className="glass panel note" role="status">
        Loading the lesson…
      </div>
    );
  }

  if (phase.name === 'error') {
    return (
      <div className="glass panel note note-error" role="alert">
        <strong>That didn’t work.</strong>
        <span>{phase.message}</span>
        <button className="btn btn-primary" type="button" onClick={goBack}>
          Back to the course
        </button>
      </div>
    );
  }

  if (phase.name === 'finishing') {
    return (
      <div className="glass panel note" role="status">
        Saving…
      </div>
    );
  }

  if (phase.name === 'retry') {
    return (
      <Retry
        set={phase.set}
        answered={phase.answered}
        onAgain={() => setRun((n) => n + 1)}
      />
    );
  }

  if (phase.name === 'done') {
    return (
      <Summary
        summary={phase.summary}
        total={phase.set.questionCount}
        next={phase.next}
        finishedUnit={phase.finishedUnit}
        held={held}
        onHold={setHeld}
      />
    );
  }

  const question = phase.set.questions[phase.index];
  const total = phase.set.questions.length;
  /** Questions put behind us — including the one showing a verdict right now. */
  const seen = phase.answered.length + (phase.result ? 1 : 0);
  const rightSoFar =
    phase.answered.filter((result) => result.correct).length +
    (phase.result?.correct ? 1 : 0);
  const isLast = phase.index === total - 1;
  /** Already failed: the run cannot complete the lesson whatever happens next. */
  const broken =
    phase.answered.some((result) => !result.correct) || phase.result?.correct === false;

  return (
    <div className="quiz">
      <div className="quiz-head">
        <button className="link-button" type="button" onClick={goBack}>
          ← Leave
        </button>
        <span className="quiz-count tabular">
          {rightSoFar} / {total} correct
        </span>
      </div>

      {/*
        One pip per question rather than a filling bar.

        A bar answers "how far through am I", which was the only question worth
        asking when a wrong answer merely came round again. Now that a single
        mistake decides the lesson, "is this run still clean" is the more useful
        question, and it needs per-question state — which a single bar cannot
        carry.
      */}
      <div
        className="quiz-pips"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={seen}
        aria-label="Lesson progress"
      >
        {phase.set.questions.map((q, position) => (
          <span
            key={q.exerciseId}
            className={`pip pip-${pipState(position, phase.index, phase.answered, phase.result)}`}
          />
        ))}
      </div>

      {/*
        Said as soon as it is true, not held back to the end.

        Letting someone answer eighteen more questions in a run that is already
        doomed, and only then telling them, would be the kind of surprise this
        screen should never spring. The offer to restart now is the point: the
        alternative is finishing a run that cannot count.
      */}
      {broken ? (
        <p className="run-broken" role="status">
          <span>
            This run can’t complete the lesson any more — finishing it still shows you the
            rest, but you’ll need a clean run to pass.
          </span>
          <button className="link-button" type="button" onClick={() => setRun((n) => n + 1)}>
            Start over now
          </button>
        </p>
      ) : null}

      {/*
        The verdict is also written on the card itself, as a colour wash — a
        right answer should be readable without moving your eyes off the thing
        you just answered. It is decoration only: the verdict block below is the
        live region, and this carries no text of its own.
      */}
      <div
        className={`glass panel quiz-card${
          phase.result ? (phase.result.correct ? ' quiz-card-right' : ' quiz-card-wrong') : ''
        }`}
      >
        <p className={`quiz-prompt ja quiz-prompt-${question.promptKind}`}>{question.prompt}</p>
        <p className="quiz-question">{question.question}</p>

        {/*
          Audio, but not where it would answer the question.

          A `vocab` prompt asks what a word *means* in English — listening
          reveals nothing, so it plays freely and hearing the word while
          choosing is exactly the point. A `wordReading` prompt asks the learner
          to type the romaji, so the recording is the answer read aloud; it is
          withheld until the verdict, where it becomes the correction. Same rule
          the app applies to review cards.
        */}
        {hasAudio(question.promptKind) &&
        (!revealsAnswer(question.promptKind) || phase.result !== null) ? (
          <div className="quiz-audio">
            {/* Both routes read the same `audio/<item id>.wav`, so this is a
                naming distinction rather than a functional one — but a kana
                asked for as a vocab would be a lie the next reader has to
                untangle. */}
            <SpeakButton
              {...(question.promptKind === 'kana'
                ? { kanaId: question.itemId }
                : { vocabId: question.itemId })}
              text={question.prompt}
              speed={audioSpeed}
              label={revealsAnswer(question.promptKind) ? 'Hear it' : 'Play'}
            />
          </div>
        ) : null}

        {question.type === 'speech' ? (
          <SpeechQuiz
            key={question.exerciseId}
            disabled={phase.result !== null || busy}
            onSubmit={(text) => void submitSpeech(question, text)}
          />
        ) : question.type === 'wordReading' ? (
          <WordReadingInput
            key={question.exerciseId}
            disabled={phase.result !== null || busy}
            onSubmit={(text) => void submitWordReading(question, text)}
          />
        ) : (
          <div className="options">
            {question.options.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`option ${optionState(option.id, phase.result)}`}
                onClick={() => void chooseMultipleChoice(question, option.id)}
                disabled={phase.result !== null || busy}
              >
                {option.value}
              </button>
            ))}
          </div>
        )}

        {phase.result ? (
          <div
            className="verdict"
            role="status"
            onMouseEnter={() => setHeld(true)}
            onMouseLeave={() => setHeld(false)}
            onFocus={() => setHeld(true)}
            onBlur={() => setHeld(false)}
          >
            <p className={phase.result.correct ? 'verdict-right' : 'verdict-wrong'}>
              {phase.result.correct ? (
                <>
                  {/* Keyed by the question, so consecutive right answers each
                      replay the wash rather than animating only once. */}
                  <CorrectFlash key={question.exerciseId} />
                  Correct
                </>
              ) : (
                '× Not quite'
              )}
            </p>
            {phase.result.correct ? null : (
              <div className="verdict-remember">
                <p className="verdict-remember-kicker">Remember this</p>
                <p className="verdict-detail">
                  {/* The widely-shared shape holds for both kinds: read the prompt,
                      then the canonical romaji. The wordReading prompt is the
                      word's written form, so "<word> is <romaji>" reads
                      correctly without a grammar-specific branch. */}
                  {question.type === 'multipleChoice' && question.promptKind === 'grammar'
                    ? `The answer is “${phase.result.correctValue}”: ${question.prompt.replace('＿', phase.result.correctValue)}`
                    : `${question.prompt} is “${phase.result.correctValue}”.`}
                </p>
              </div>
            )}

            <button className="btn btn-primary" type="button" onClick={() => void advance()}>
              {isLast ? 'Finish' : 'Next'}
            </button>

            <Tick
              ms={phase.result.correct ? CORRECT_MS : WRONG_MS}
              held={held}
              label={isLast ? 'Finishing automatically' : 'Moving on automatically'}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The bar that runs down while a verdict is on screen, so the advance is
 * something the learner can see coming rather than a jump.
 *
 * Purely decorative: the timer it mirrors lives in an effect, so under
 * `prefers-reduced-motion` — where the global rule collapses animations to
 * 0.01ms — the bar fills at once while the timer still runs its full length.
 * The advance is never faster than it looks. `aria-hidden` because the verdict
 * it sits in is already a live region, and announcing a countdown on top of
 * that is noise.
 */
function Tick({ ms, held, label }: { ms: number; held: boolean; label: string }) {
  return (
    <span className="tick" title={held ? 'Paused — move away to continue' : label} aria-hidden="true">
      <span
        className="tick-fill"
        style={{ animationDuration: `${ms}ms`, animationPlayState: held ? 'paused' : 'running' }}
      />
    </span>
  );
}

/**
 * Reached the end of a lesson with at least one wrong answer.
 *
 * This screen is the whole point of the change: the lesson is not finished, no
 * XP was earned, and the way forward is to run it again. Listing what went
 * wrong makes the repeat a study aid rather than a punishment — the learner
 * sees the four they missed before re-answering all twelve.
 */
function Retry({
  set,
  answered,
  onAgain,
}: {
  set: ExerciseSet;
  answered: AnswerResult[];
  onAgain: () => void;
}) {
  const wrong = answered.filter((result) => !result.correct);
  const byExerciseId = new Map(set.questions.map((q) => [q.exerciseId, q]));

  return (
    <div className="glass panel quiz-summary">
      <h2>Not quite finished</h2>
      <p className="summary-note">
        {wrong.length === 1
          ? 'One answer was wrong, so this lesson is not complete yet.'
          : `${wrong.length} answers were wrong, so this lesson is not complete yet.`}{' '}
        Run it again and get every question right to finish it.
      </p>

      <ul className="missed">
        {wrong.map((result) => {
          const question = byExerciseId.get(result.exerciseId);
          return (
            <li key={result.exerciseId}>
              <span className="ja missed-prompt">{result.prompt}</span>
              <span className="missed-answer">
                {question?.type === 'multipleChoice' && question.promptKind === 'grammar'
                  ? question.prompt.replace('＿', result.correctValue)
                  : result.correctValue}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="summary-actions">
        <button className="btn btn-primary" type="button" onClick={onAgain}>
          Run it again
        </button>
        <button className="link-button" type="button" onClick={goBack}>
          Back to the course
        </button>
      </div>
    </div>
  );
}

/**
 * What one pip shows.
 *
 * `answered` is parallel to `questions` because the walk only ever moves
 * forward — question *n* is answered at step *n* — which is what lets a
 * position index read its own result without a lookup.
 */
function pipState(
  position: number,
  index: number,
  answered: AnswerResult[],
  result: AnswerResult | null,
): 'right' | 'wrong' | 'now' | 'todo' {
  if (position < answered.length) return answered[position].correct ? 'right' : 'wrong';
  if (position === index) {
    if (result === null) return 'now';
    return result.correct ? 'right' : 'wrong';
  }
  return 'todo';
}

function optionState(id: string, result: AnswerResult | null): string {
  if (!result) return '';
  if (id === result.correctOptionId) return 'option-answer';
  if (id === result.selectedOptionId) return 'option-wrong';
  return 'option-muted';
}

/**
 * The wordReading input: a single line of text and a Submit button.
 *
 * The submit is form-driven so Enter on the keyboard submits naturally; the
 * button click does the same thing. The disabled-when-empty guard is the
 * part that prevents a learner from accidentally submitting nothing.
 *
 * Keyed by `exerciseId` at the call site so moving to the next question mounts
 * a fresh one — without that the previous word's romaji would still be sitting
 * in the box.
 */
function WordReadingInput({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // The learner is going to type; put the caret where they can. Auto-advance
  // makes this matter more than it did — there is no click between questions
  // any more that would have moved focus here.
  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(text);
  }

  return (
    <form className="typing" onSubmit={handleSubmit}>
      <input
        ref={inputRef}
        className="typing-input"
        type="text"
        value={text}
        placeholder="Type the romaji"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        onChange={(event) => setText(event.target.value)}
        disabled={disabled}
        aria-label="Type the romaji for this word"
      />
      <button className="btn btn-primary" type="submit" disabled={disabled || text.trim().length === 0}>
        Submit
      </button>
    </form>
  );
}

/** Where a clean run goes next, and why. */
/**
 * The unit this lesson just *finished*, if it finished one.
 *
 * The checkpoint's whole discoverability problem is that it lives at the foot
 * of a completed unit in the curriculum, and a completed unit collapses — so
 * the learner who has just earned the test is the one least likely to see it.
 * This is the moment it belongs to.
 *
 * The test is "every lesson in this unit is now complete", not "this was the
 * last lesson in the unit". Practising lesson 3 of 5 must not offer the test,
 * and a learner who finished the unit out of order still deserves it.
 *
 * `completedLessonIds` is the set from *before* this completion — `/me/progress`
 * has not been refetched yet — so the lesson just finished is unioned in.
 * Without that the last lesson of a unit never qualifies, which is precisely
 * the case this exists for.
 *
 * Returns null when progress is unknown: with no completed set we cannot tell a
 * finished unit from an untouched one, and offering a test on a guess is worse
 * than not offering it.
 */
function unitFinishedBy(
  units: Unit[],
  completedLessonIds: string[] | null,
  lessonId: string,
): Unit | null {
  if (completedLessonIds === null) return null;

  const unit = units.find((candidate) =>
    candidate.lessons.some((lesson) => lesson.id === lessonId),
  );
  if (!unit) return null;

  const done = new Set([...completedLessonIds, lessonId]);
  return unit.lessons.every((lesson) => done.has(lesson.id)) ? unit : null;
}

function stepAfter(
  units: Unit[],
  completedLessonIds: string[] | null,
  lessonId: string,
): NextStep {
  if (units.length === 0) return { kind: 'unknown' };

  const next = nextLessonAfter(units, lessonId);
  if (!next) return { kind: 'courseComplete' };

  // Null progress means we cannot confirm the next lesson has been taught, so
  // we take the cautious branch and send them to read it. Auto-starting a quiz
  // on unseen material is the failure this whole flow exists to avoid.
  const learned = completedLessonIds?.includes(next.id) ?? false;
  return learned ? { kind: 'practise', lesson: next } : { kind: 'learn', lesson: next };
}

function goToStep(step: NextStep): void {
  log('quiz', `next step after this lesson: ${step.kind}`, {
    lessonId: step.kind === 'practise' || step.kind === 'learn' ? step.lesson.id : null,
  });

  if (step.kind === 'practise') go({ name: 'lesson', id: step.lesson.id });
  // `{ name: 'catalog', learn }` — a search param on `/courses`, where the
  // syllabus now lives. It emitted `#/learn/<id>` until 2026-07-30 and
  // `#/?learn=<id>` until the dashboard took `/`; both fixes were in
  // `useRoute.ts`'s `go()` and this call site only names the destination.
  else if (step.kind === 'learn') go({ name: 'catalog', learn: step.lesson.id });
  else go({ name: 'home' });
}

function Summary({
  summary,
  total,
  next,
  finishedUnit,
  held,
  onHold,
}: {
  summary: CompleteResult;
  total: number;
  next: NextStep;
  /** Set when this completion finished a whole unit — see the `done` phase. */
  finishedUnit: Unit | null;
  held: boolean;
  onHold: (held: boolean) => void;
}) {
  const xpRef = useRef<HTMLSpanElement>(null);
  const bannerRef = useRef<HTMLParagraphElement>(null);

  // Counts from zero on mount. `countUpNow` writes the final value straight in
  // when motion is reduced or anime.js never armed, so the number is never left
  // reading zero — which is the one value it must not show.
  useEffect(() => {
    if (xpRef.current) countUpNow(xpRef.current, summary.xpAwarded);
  }, [summary.xpAwarded]);

  /*
   * Confetti for finishing, fired from the banner.
   *
   * The original plan put this behind a "perfect run" check — but every run
   * that reaches this screen is already perfect, because the quiz is
   * pass-or-repeat and a single wrong answer routes to `Retry` instead. A
   * PERFECT! banner gated on a condition that is always true would be noise, so
   * the celebration is simply for completing, and the copy says the true thing.
   */
  useEffect(() => {
    if (bannerRef.current) burstConfetti(bannerRef.current, { count: 54 });
  }, []);

  return (
    <div
      className="glass panel quiz-summary"
      onMouseEnter={() => onHold(true)}
      onMouseLeave={() => onHold(false)}
      onFocus={() => onHold(true)}
      onBlur={() => onHold(false)}
    >
      <h2>Lesson complete</h2>

      {/* Every completion is now a clean run by construction — the only way to
          reach this screen is to have got everything right — so the score line
          says so rather than making the reader compare two equal numbers. */}
      <p className="clean-run" ref={bannerRef}>
        Clean run — {total} of {total}.
      </p>

      <dl className="summary-rows">
        <div>
          <dt>XP earned</dt>
          <dd className="tabular accent">
            +<span ref={xpRef}>{summary.xpAwarded}</span>
          </dd>
        </div>
        <div>
          <dt>Total XP</dt>
          <dd className="tabular">{summary.totalXp}</dd>
        </div>
      </dl>

      <p className="summary-note">
        {summary.firstCompletion
          ? 'Lesson progress has been saved.'
          : 'You had already finished this one, so the XP is the smaller practice award.'}
      </p>

      {/*
        The unit's test, offered at the one moment it is earned.

        Above the "next lesson" block and styled as the primary action, because
        finishing a unit is the event and moving on is the default that happens
        anyway. A `<Link>` rather than `goToStep`: `useRoute`'s `go()` is a
        compatibility shim its own comment says not to extend, and a typed `to`
        is checked against the route tree where a hand-written hash is not.
      */}
      {finishedUnit ? (
        <div className="unit-cleared">
          <p className="up-next-line">
            <strong>You’ve finished {finishedUnit.label}.</strong> Test yourself on the whole
            unit — 20 questions, one answer each, and nothing is locked by the result.
          </p>
          <Link className="btn btn-primary" to="/checkpoint/$unit" params={{ unit: finishedUnit.slug }}>
            Take the test
          </Link>
        </div>
      ) : null}

      <div className="up-next">
        {next.kind === 'unknown' ? null : next.kind === 'courseComplete' ? (
          <p className="up-next-line">
            <strong>That is the last lesson.</strong> You have completed the current course.
          </p>
        ) : next.kind === 'practise' ? (
          <p className="up-next-line">
            <strong>Next:</strong> {next.lesson.title} — you have learned this one, so it
            starts straight away.
          </p>
        ) : (
          <p className="up-next-line">
            <strong>Next:</strong> {next.lesson.title} — you have not learned this one yet.
            Read it through first, then start it.
          </p>
        )}

        <div className="summary-actions">
          <button
            // Steps down to secondary when a test is on offer above it, so the
            // two primaries do not compete for the same tap.
            className={finishedUnit ? 'btn btn-secondary' : 'btn btn-primary'}
            type="button"
            onClick={() => goToStep(next)}
          >
            {next.kind === 'practise'
              ? 'Start it now'
              : next.kind === 'learn'
                ? 'Go and learn it'
                : 'Back to the course'}
          </button>
          {next.kind === 'courseComplete' || next.kind === 'unknown' ? null : (
            <button className="link-button" type="button" onClick={goBack}>
              Back to the course
            </button>
          )}
        </div>

        {/* Only when something is actually counting down. The auto-advance is
            off while a checkpoint is offered, and a bar that fills and then does
            nothing is worse than no bar. */}
        {finishedUnit ? null : (
          <Tick ms={NEXT_MS} held={held} label="Continuing automatically" />
        )}
      </div>
    </div>
  );
}
