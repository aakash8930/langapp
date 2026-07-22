import { useEffect, useState } from 'react';

import {
  answerExercise,
  completeLesson,
  fetchExercises,
  newAttempt,
  type AnswerResult,
  type CompleteResult,
  type ExerciseSet,
  type Question,
} from '../api';
import { goBack } from '../useRoute';

type Phase =
  | { name: 'loading' }
  | { name: 'error'; message: string }
  | { name: 'asking'; set: ExerciseSet; index: number; result: AnswerResult | null }
  | { name: 'finishing'; set: ExerciseSet }
  | { name: 'done'; set: ExerciseSet; summary: CompleteResult; correct: number };

/**
 * One run through a lesson: every item asked once, then the lesson is completed.
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
        if (!cancelled) setPhase({ name: 'asking', set, index: 0, result: null });
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

  async function choose(question: Question, optionId: string) {
    if (phase.name !== 'asking' || phase.result || busy) return;

    setBusy(true);
    try {
      const result = await answerExercise(lessonId, question.exerciseId, optionId);
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

    const isLast = phase.index === phase.set.questions.length - 1;
    if (!isLast) {
      setPhase({ ...phase, index: phase.index + 1, result: null });
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

  const question = phase.set.questions[phase.index];
  const total = phase.set.questions.length;

  return (
    <div className="quiz">
      <div className="quiz-head">
        <button className="link-button" type="button" onClick={goBack}>
          ← Leave
        </button>
        <span className="quiz-count tabular">
          {phase.index + 1} / {total}
        </span>
      </div>

      <div
        className="quiz-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={phase.index}
        aria-label="Lesson progress"
      >
        <span style={{ width: `${(phase.index / total) * 100}%` }} />
      </div>

      <div className="glass panel quiz-card">
        <p className={`quiz-prompt ja quiz-prompt-${question.promptKind}`}>{question.prompt}</p>
        <p className="quiz-question">{question.question}</p>

        <div className="options">
          {question.options.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`option ${optionState(option.id, phase.result)}`}
              onClick={() => void choose(question, option.id)}
              disabled={phase.result !== null || busy}
            >
              {option.value}
            </button>
          ))}
        </div>

        {phase.result ? (
          <div className="verdict" role="status">
            <p className={phase.result.correct ? 'verdict-right' : 'verdict-wrong'}>
              {phase.result.correct ? '○ Correct' : '× Not quite'}
            </p>
            {phase.result.correct ? null : (
              <p className="verdict-detail">
                {/* "sentence is 'は'" reads as nonsense — a gapped sentence is
                    not a particle — so grammar shows the sentence filled in. */}
                {question.promptKind === 'grammar'
                  ? `The answer is “${phase.result.correctValue}”: ${question.prompt.replace('＿', phase.result.correctValue)}`
                  : `${phase.result.prompt} is “${phase.result.correctValue}”.`}
              </p>
            )}
            <button className="button" type="button" onClick={() => void next()}>
              {phase.index === total - 1 ? 'Finish lesson' : 'Next'}
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
