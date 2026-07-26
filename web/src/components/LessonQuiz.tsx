import { useEffect, useState, type FormEvent } from 'react';

import {
  answerExercise,
  completeLesson,
  fetchExercises,
  newAttempt,
  type AnswerResult,
  type CompleteResult,
  type ExerciseSet,
  type MultipleChoiceQuestion,
  type WordReadingQuestion,
} from '../api';
import { goBack } from '../useRoute';

type Phase =
  | { name: 'loading' }
  | { name: 'error'; message: string }
  /**
   * `queue` holds indices into `set.questions`, front-first, containing only the
   * questions **not yet answered correctly**. A wrong answer sends its question
   * to the back rather than letting the learner past it, so a finished lesson is
   * a drained queue — the same rule the server's completion gate enforces.
   *
   * Replaced a walking `index`, which let someone answer everything wrong and
   * still finish. Reported from the live site 2026-07-26.
   */
  | { name: 'asking'; set: ExerciseSet; queue: number[]; result: AnswerResult | null }
  | { name: 'finishing'; set: ExerciseSet }
  | { name: 'done'; set: ExerciseSet; summary: CompleteResult; correct: number };

/**
 * One run through a lesson: every item asked until answered correctly, then the
 * lesson is completed.
 *
 * Answering is a **round trip** — the exercise payload carries no answer key, by
 * design, so the server is the only thing that knows. That is why an option
 * shows a pending state rather than colouring immediately.
 */
export function LessonQuiz({
  lessonId,
  onFinished,
}: {
  lessonId: string;
  onFinished: () => void;
}) {
  const [phase, setPhase] = useState<Phase>({ name: 'loading' });
  const [correct, setCorrect] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Drawn once per mount. Re-drawing mid-lesson would reshuffle the questions
    // and invalidate the exerciseIds already on screen.
    const attempt = newAttempt();

    fetchExercises(lessonId, attempt)
      .then((set) => {
        if (!cancelled) {
          setPhase({
            name: 'asking',
            set,
            queue: set.questions.map((_, position) => position),
            result: null,
          });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setPhase({
            name: 'error',
            message: error instanceof Error ? error.message : 'Could not load this lesson.',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  async function chooseMultipleChoice(question: MultipleChoiceQuestion, optionId: string) {
    if (phase.name !== 'asking' || phase.result || busy) return;

    setBusy(true);
    try {
      const result = await answerExercise(lessonId, question.exerciseId, { optionId });
      if (result.correct) setCorrect((n) => n + 1);
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
      if (result.correct) setCorrect((n) => n + 1);
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

  async function next() {
    if (phase.name !== 'asking') return;

    const [current, ...rest] = phase.queue;
    // Right answers leave the queue; wrong ones go to the back to be re-asked.
    const queue = phase.result?.correct ? rest : [...rest, current];

    if (queue.length > 0) {
      setPhase({ ...phase, queue, result: null });
      return;
    }

    setPhase({ name: 'finishing', set: phase.set });
    try {
      const summary = await completeLesson(lessonId);
      setPhase({ name: 'done', set: phase.set, summary, correct });
      onFinished();
    } catch (error) {
      setPhase({
        name: 'error',
        message: error instanceof Error ? error.message : 'Could not save this lesson.',
      });
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
        <button className="button" type="button" onClick={goBack}>
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

  if (phase.name === 'done') {
    return <Summary summary={phase.summary} correct={phase.correct} total={phase.set.questionCount} />;
  }

  const question = phase.set.questions[phase.queue[0]];
  const total = phase.set.questions.length;
  /** Answered correctly, so gone from the queue. Drives the count and the bar. */
  const mastered = total - phase.queue.length;
  /** True when answering *this* one correctly drains the queue. */
  const isLast = phase.queue.length === 1 && phase.result?.correct === true;

  return (
    <div className="quiz">
      <div className="quiz-head">
        <button className="link-button" type="button" onClick={goBack}>
          ← Leave
        </button>
        <span className="quiz-count tabular">
          {mastered} / {total} correct
        </span>
      </div>

      <div
        className="quiz-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={mastered}
        aria-label="Lesson progress"
      >
        {/* Counts what is learned, not what is seen — a re-asked question must
            not advance the bar, or getting things wrong would look like
            progress. */}
        <span style={{ width: `${(mastered / total) * 100}%` }} />
      </div>

      <div className="glass panel quiz-card">
        <p className={`quiz-prompt ja quiz-prompt-${question.promptKind}`}>{question.prompt}</p>
        <p className="quiz-question">{question.question}</p>

        {question.type === 'wordReading' ? (
          <WordReadingInput
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
          <div className="verdict" role="status">
            <p className={phase.result.correct ? 'verdict-right' : 'verdict-wrong'}>
              {phase.result.correct ? '○ Correct' : '× Not quite'}
            </p>
            {phase.result.correct ? null : (
              <p className="verdict-detail">
                {/* The widely-shared shape holds for both kinds: read the prompt,
                    then the canonical romaji. The wordReading prompt is the
                    word's written form, so "<word> is <romaji>" reads
                    correctly without a grammar-specific branch. */}
                {question.type === 'multipleChoice' && question.promptKind === 'grammar'
                  ? `The answer is “${phase.result.correctValue}”: ${question.prompt.replace('＿', phase.result.correctValue)}`
                  : `${question.prompt} is “${phase.result.correctValue}”.`}
              </p>
            )}
            <button className="button" type="button" onClick={() => void next()}>
              {isLast
                ? 'Finish lesson'
                : phase.result.correct
                  ? 'Next'
                  : 'Try this one again later'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
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
 */
function WordReadingInput({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(text);
  }

  return (
    <form className="typing" onSubmit={handleSubmit}>
      <input
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
      <button
        className="button"
        type="submit"
        disabled={disabled || text.trim().length === 0}
      >
        Submit
      </button>
    </form>
  );
}

function Summary({
  summary,
  correct,
  total,
}: {
  summary: CompleteResult;
  correct: number;
  total: number;
}) {
  return (
    <div className="glass panel quiz-summary">
      <h2>Lesson complete</h2>

      <dl className="summary-rows">
        <div>
          <dt>Correct</dt>
          <dd className="tabular">
            {correct} of {total}
          </dd>
        </div>
        <div>
          <dt>XP earned</dt>
          <dd className="tabular accent">+{summary.xpAwarded}</dd>
        </div>
        <div>
          <dt>{summary.firstCompletion ? 'New review cards' : 'Cards already in review'}</dt>
          <dd className="tabular">
            {summary.firstCompletion ? summary.cardsCreated : summary.cardsAlreadyPresent}
          </dd>
        </div>
      </dl>

      <p className="summary-note">
        {summary.firstCompletion
          ? 'Those cards come back on their own schedule. Reviewing them is what makes this stick — that part is in the app for now.'
          : 'You had already finished this one, so the XP is the smaller practice award.'}
      </p>

      <button className="button" type="button" onClick={goBack}>
        Back to the course
      </button>
    </div>
  );
}
