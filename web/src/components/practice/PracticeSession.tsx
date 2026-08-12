import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  answerPracticeQuestion,
  completePracticeSession,
  createPracticeSession,
} from '../../api';
import { queryKeys } from '../../queryKeys';
import { useSession } from '../../useSession';
import { Icon, type IconName } from '../ui/Icon';
import type {
  PracticeAnswerResponse,
  PracticeLevel,
  PracticeMode,
  PracticeSession as PracticeSessionData,
  PracticeSkill,
} from './practiceTypes';
import './practice.css';

const SKILLS: { id: PracticeSkill; label: string; icon: IconName }[] = [
  { id: 'vocabulary', label: 'Vocabulary', icon: 'book-open' },
  { id: 'kanji', label: 'Kanji', icon: 'languages' },
  { id: 'grammar', label: 'Grammar', icon: 'message-circle' },
  { id: 'reading', label: 'Reading', icon: 'newspaper' },
];

export type PracticeModeConfig = {
  mode: PracticeMode;
  title: string;
  eyebrow: string;
  description: string;
  icon: IconName;
  defaultCount: number;
  allowCount?: boolean;
  allowSkills?: boolean;
  allowLevel?: boolean;
  allowTime?: boolean;
  startLabel: string;
  note: string;
};

export function PracticeSessionPage({ config, initialSkills }: { config: PracticeModeConfig; initialSkills?: PracticeSkill[] }) {
  const { session: auth } = useSession();
  const queryClient = useQueryClient();
  const [practice, setPractice] = useState<PracticeSessionData | null>(null);
  const [count, setCount] = useState(config.defaultCount);
  const [skills, setSkills] = useState<PracticeSkill[]>(
    initialSkills?.length ? initialSkills : SKILLS.map((skill) => skill.id),
  );
  const [level, setLevel] = useState<PracticeLevel>('all');
  const [minutes, setMinutes] = useState(5);
  const [index, setIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [feedback, setFeedback] = useState<PracticeAnswerResponse['answer'] | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const answerStartedAt = useRef(Date.now());
  const timerFinalized = useRef(false);

  const createMutation = useMutation({
    mutationFn: createPracticeSession,
    onSuccess: (created) => {
      setPractice(created);
      setIndex(0);
      setFeedback(null);
      setSelectedOption(null);
      setTypedAnswer('');
      answerStartedAt.current = Date.now();
      timerFinalized.current = false;
    },
  });
  const completeMutation = useMutation({
    mutationFn: (sessionId: string) => completePracticeSession(sessionId),
    onSuccess: (completed) => {
      setPractice(completed);
      void queryClient.invalidateQueries({ queryKey: queryKeys.practice.overview });
    },
  });
  const finishSession = completeMutation.mutate;
  const answerMutation = useMutation({
    mutationFn: ({
      sessionId,
      questionId,
      body,
    }: {
      sessionId: string;
      questionId: string;
      body: ({ optionId: string } | { text: string }) & { responseTimeMs: number };
    }) => answerPracticeQuestion(sessionId, questionId, body),
    onSuccess: (response) => {
      setFeedback(response.answer);
      setPractice((current) => {
        if (!current) return current;
        if (response.session) return response.session;
        const answers = [...current.answers, response.answer];
        return {
          ...current,
          answers,
          questions: current.questions.map((question) =>
            question.id === response.answer.questionId ? { ...question, answered: true } : question,
          ),
          score: response.progress.score,
          maxCombo: response.progress.maxCombo,
          metrics: {
            ...current.metrics,
            answered: response.progress.answered,
            correct: answers.filter((answer) => answer.correct).length,
            mistakes: answers.filter((answer) => !answer.correct).length,
            accuracy: answers.length
              ? Math.round((answers.filter((answer) => answer.correct).length / answers.length) * 100)
              : 0,
          },
        };
      });
      if (response.progress.complete) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.practice.overview });
      }
    },
    onError: () => {
      if (practice?.deadlineAt && Date.now() >= new Date(practice.deadlineAt).getTime()) {
        completeMutation.mutate(practice.id);
      }
    },
  });

  useEffect(() => {
    if (!practice?.deadlineAt || practice.status === 'completed') {
      setRemaining(null);
      return;
    }
    const update = () => {
      const seconds = Math.max(0, Math.ceil((new Date(practice.deadlineAt!).getTime() - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds === 0 && !timerFinalized.current) {
        timerFinalized.current = true;
        finishSession(practice.id);
      }
    };
    update();
    const id = window.setInterval(update, 250);
    return () => window.clearInterval(id);
  }, [practice?.deadlineAt, practice?.id, practice?.status, finishSession]);

  const question = practice?.questions[index];
  const answeredIds = useMemo(
    () => new Set(practice?.answers.map((answer) => answer.questionId) ?? []),
    [practice?.answers],
  );

  const start = () => {
    createMutation.mutate({
      mode: config.mode,
      questionCount: count,
      ...(config.allowSkills ? { skills } : {}),
      ...(config.allowLevel ? { level } : {}),
      ...(config.allowTime ? { timeLimitMinutes: minutes } : {}),
    });
  };

  const toggleSkill = (skill: PracticeSkill) => {
    setSkills((current) =>
      current.includes(skill)
        ? current.length === 1 ? current : current.filter((entry) => entry !== skill)
        : [...current, skill],
    );
  };

  const submitAnswer = (optionId?: string) => {
    if (!practice || !question || feedback || answerMutation.isPending) return;
    const responseTimeMs = Math.max(0, Date.now() - answerStartedAt.current);
    const body = question.type === 'multipleChoice'
      ? { optionId: optionId ?? selectedOption ?? '', responseTimeMs }
      : { text: typedAnswer, responseTimeMs };
    answerMutation.mutate({ sessionId: practice.id, questionId: question.id, body });
  };

  const next = () => {
    if (!practice) return;
    const nextIndex = practice.questions.findIndex(
      (candidate, candidateIndex) => candidateIndex > index && !answeredIds.has(candidate.id),
    );
    if (nextIndex < 0) {
      completeMutation.mutate(practice.id);
      return;
    }
    setIndex(nextIndex);
    setSelectedOption(null);
    setTypedAnswer('');
    setFeedback(null);
    answerStartedAt.current = Date.now();
  };

  const restart = () => {
    setPractice(null);
    setFeedback(null);
    setSelectedOption(null);
    setTypedAnswer('');
    setRemaining(null);
    createMutation.reset();
    answerMutation.reset();
    completeMutation.reset();
  };

  if (auth.state === 'loading') {
    return <PracticeState icon="refresh-cw" title="Checking your Practice account…" />;
  }
  if (auth.state === 'signedOut') {
    return (
      <PracticeState
        icon="lock"
        title="Sign in to start Practice"
        body="Generated sessions, mistakes, confidence evidence, scores, and personal bests belong to your account."
      >
        <Link className="btn btn-primary" to="/signin">Sign in</Link>
      </PracticeState>
    );
  }

  if (!practice) {
    return (
      <div className="page practice-page">
        <PracticeHeader config={config} />
        <section className="practice-setup glass" aria-labelledby="practice-setup-title">
          <div className="practice-setup-icon"><Icon name={config.icon} size={30} /></div>
          <div>
            <p className="practice-eyebrow">Session setup</p>
            <h2 id="practice-setup-title">{config.startLabel}</h2>
            <p>{config.note}</p>
          </div>

          {config.allowSkills && (
            <fieldset className="practice-fieldset">
              <legend>Skills</legend>
              <div className="practice-chip-grid">
                {SKILLS.map((skill) => {
                  const active = skills.includes(skill.id);
                  return (
                    <button
                      key={skill.id}
                      type="button"
                      className={`practice-chip${active ? ' is-active' : ''}`}
                      aria-pressed={active}
                      onClick={() => toggleSkill(skill.id)}
                    >
                      <Icon name={skill.icon} size={17} /> {skill.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          <div className="practice-setup-row">
            {config.allowCount && (
              <label className="practice-select-label">
                Questions
                <select value={count} onChange={(event) => setCount(Number(event.target.value))}>
                  {[5, 10, 15, 20, 30, 40].map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
            )}
            {config.allowLevel && (
              <label className="practice-select-label">
                Level
                <select value={level} onChange={(event) => setLevel(event.target.value as PracticeLevel)}>
                  <option value="all">All available</option>
                  <option value="foundation">Foundation kana</option>
                  <option value="N5">JLPT N5 catalog</option>
                </select>
              </label>
            )}
            {config.allowTime && (
              <label className="practice-select-label">
                Time limit
                <select value={minutes} onChange={(event) => setMinutes(Number(event.target.value))}>
                  {[3, 5, 10, 15].map((value) => <option key={value} value={value}>{value} minutes</option>)}
                </select>
              </label>
            )}
          </div>

          {createMutation.isError && (
            <div className="practice-inline-error" role="alert">
              <Icon name="circle-alert" size={18} />
              <span>{errorMessage(createMutation.error)}</span>
            </div>
          )}
          <button
            type="button"
            className="btn btn-primary practice-start-btn"
            onClick={start}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Building from real course content…' : config.startLabel}
            {!createMutation.isPending && <Icon name="arrow-right" size={18} />}
          </button>
        </section>
      </div>
    );
  }

  if (practice.status === 'completed') {
    return <PracticeResults session={practice} config={config} onRestart={restart} />;
  }

  if (!question) {
    return (
      <PracticeState icon="circle-alert" title="This session has no available question" body="Finish it to keep its completion statistics truthful.">
        <button className="btn btn-primary" onClick={() => completeMutation.mutate(practice.id)}>Finish session</button>
      </PracticeState>
    );
  }

  return (
    <div className="page practice-page">
      <PracticeHeader config={config} compact />
      <section className="practice-session-shell">
        <div className="practice-session-topline">
          <span className={`practice-skill-tag skill-${question.skill}`}>{skillLabel(question.skill)}</span>
          <span className="practice-progress-label tabular">{index + 1} / {practice.metrics.total}</span>
          {remaining !== null && (
            <span className={`practice-timer tabular${remaining <= 20 ? ' is-urgent' : ''}`}>
              <Icon name="history" size={16} /> {formatClock(remaining)}
            </span>
          )}
          {config.mode === 'challenge' && (
            <span className="practice-score tabular"><Icon name="zap" size={16} /> {practice.score} pts</span>
          )}
        </div>
        <div className="practice-progress-track" aria-hidden="true">
          <span style={{ width: `${Math.round((practice.metrics.answered / practice.metrics.total) * 100)}%` }} />
        </div>

        <article className="practice-question-card glass">
          <p className="practice-question-source">{question.lessonTitle} · Server-generated {formatType(question.type)}</p>
          <p className="practice-question-instruction">{question.question}</p>
          <h2 className={`practice-prompt prompt-${question.promptKind}`} lang="ja">{question.prompt}</h2>

          {question.type === 'multipleChoice' && question.options && (
            <div className="practice-options">
              {question.options.map((option, optionIndex) => {
                const selected = selectedOption === option.id;
                const isCorrect = feedback?.correctValue === option.value;
                const isWrong = Boolean(feedback && selected && !feedback.correct);
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`practice-option${selected ? ' is-selected' : ''}${feedback && isCorrect ? ' is-correct' : ''}${isWrong ? ' is-wrong' : ''}`}
                    onClick={() => {
                      setSelectedOption(option.id);
                      submitAnswer(option.id);
                    }}
                    disabled={Boolean(feedback) || answerMutation.isPending}
                  >
                    <span className="practice-option-key">{String.fromCharCode(65 + optionIndex)}</span>
                    <span>{option.value}</span>
                  </button>
                );
              })}
            </div>
          )}

          {question.type === 'wordReading' && (
            <form className="practice-typing" onSubmit={(event) => { event.preventDefault(); submitAnswer(); }}>
              <label htmlFor="practice-answer">Type the romaji reading</label>
              <input
                id="practice-answer"
                value={typedAnswer}
                onChange={(event) => setTypedAnswer(event.target.value)}
                autoComplete="off"
                autoFocus
                disabled={Boolean(feedback) || answerMutation.isPending}
              />
              {!feedback && (
                <button className="btn btn-primary" disabled={!typedAnswer.trim() || answerMutation.isPending}>
                  Check answer
                </button>
              )}
            </form>
          )}

          {answerMutation.isError && (
            <div className="practice-inline-error" role="alert">
              <Icon name="wifi-off" size={18} /> {errorMessage(answerMutation.error)}
            </div>
          )}

          {feedback && (
            <div className={`practice-feedback ${feedback.correct ? 'is-correct' : 'is-wrong'}`} role="status">
              <div>
                <strong>{feedback.correct ? 'Correct' : 'Not quite'}</strong>
                {!feedback.correct && (
                  <span>Your answer: {feedback.selectedValue || 'No answer'} · Correct: {feedback.correctValue}</span>
                )}
                {feedback.correct && <span>+{feedback.points} points · {feedback.responseTimeMs < 1000 ? '<1' : Math.round(feedback.responseTimeMs / 1000)}s</span>}
              </div>
              <button type="button" className="btn btn-primary" onClick={next}>
                {practice.metrics.answered >= practice.metrics.total ? 'See results' : 'Next question'}
                <Icon name="arrow-right" size={17} />
              </button>
            </div>
          )}
        </article>

        <button
          type="button"
          className="practice-finish-link"
          onClick={() => completeMutation.mutate(practice.id)}
          disabled={completeMutation.isPending}
        >
          {completeMutation.isPending ? 'Saving results…' : 'Finish with answered questions'}
        </button>
      </section>
    </div>
  );
}

function PracticeHeader({ config, compact = false }: { config: PracticeModeConfig; compact?: boolean }) {
  return (
    <header className={`practice-mode-header${compact ? ' is-compact' : ''}`}>
      <div>
        <Link className="practice-back" to="/practice-hub"><Icon name="chevron-left" size={16} /> Practice Hub</Link>
        <p className="practice-eyebrow">{config.eyebrow}</p>
        <h1>{config.title}</h1>
        {!compact && <p>{config.description}</p>}
      </div>
      <div className="practice-mode-icon"><Icon name={config.icon} size={30} /></div>
    </header>
  );
}

function PracticeResults({ session, config, onRestart }: { session: PracticeSessionData; config: PracticeModeConfig; onRestart: () => void }) {
  const mistakes = session.answers.filter((answer) => !answer.correct);
  return (
    <div className="page practice-page">
      <PracticeHeader config={config} compact />
      <section className="practice-results glass">
        <div className="practice-result-mark"><Icon name={session.metrics.accuracy >= 70 ? 'trophy' : 'brain'} size={38} /></div>
        <p className="practice-eyebrow">Session saved</p>
        <h2>{session.metrics.accuracy >= 80 ? 'Strong application' : session.metrics.accuracy >= 60 ? 'Good practice' : 'Useful evidence gathered'}</h2>
        <p>Every answer was graded by the server and is now part of your Practice history and confidence evidence.</p>
        <div className="practice-result-grid">
          <ResultMetric value={`${session.metrics.accuracy}%`} label="Accuracy" />
          <ResultMetric value={`${session.metrics.correct}/${session.metrics.answered}`} label="Correct" />
          <ResultMetric value={formatDuration(session.durationSeconds ?? 0)} label="Practice time" />
          {session.mode === 'challenge'
            ? <ResultMetric value={session.score.toLocaleString()} label="Score" />
            : <ResultMetric value={String(session.metrics.mistakes)} label="Mistakes" />}
          {session.mode === 'challenge' && <ResultMetric value={`${session.maxCombo}×`} label="Best combo" />}
          {session.xpAwarded > 0 && <ResultMetric value={`+${session.xpAwarded}`} label="XP awarded" />}
        </div>
        <div className="practice-result-actions">
          <button type="button" className="btn btn-primary" onClick={onRestart}><Icon name="repeat" size={17} /> Practice again</button>
          <Link className="btn btn-secondary" to="/practice-hub">Back to Practice Hub</Link>
        </div>
      </section>

      <section className="practice-mistakes-section">
        <div className="practice-section-heading">
          <div><p className="practice-eyebrow">Mistake review</p><h2>{mistakes.length ? `${mistakes.length} answer${mistakes.length === 1 ? '' : 's'} to revisit` : 'No mistakes this time'}</h2></div>
          <span>Answers appear only after server grading</span>
        </div>
        {mistakes.length ? (
          <div className="practice-mistake-list">
            {mistakes.map((mistake, index) => (
              <article key={mistake.questionId} className="practice-mistake-card glass">
                <span className="practice-mistake-number">{String(index + 1).padStart(2, '0')}</span>
                <div><strong lang="ja">{mistake.prompt}</strong><span>{skillLabel(mistake.skill)} · {Math.round(mistake.responseTimeMs / 1000)}s</span></div>
                <dl><div><dt>Your answer</dt><dd>{mistake.selectedValue || 'No answer'}</dd></div><div><dt>Correct answer</dt><dd>{mistake.correctValue}</dd></div></dl>
              </article>
            ))}
          </div>
        ) : (
          <div className="practice-empty glass"><Icon name="check-circle-2" size={28} /><p>Your clean session is saved. Try Challenge Mode when you want more pressure.</p></div>
        )}
      </section>
    </div>
  );
}

function ResultMetric({ value, label }: { value: string; label: string }) {
  return <div><strong className="tabular">{value}</strong><span>{label}</span></div>;
}

function PracticeState({ icon, title, body, children }: { icon: IconName; title: string; body?: string; children?: React.ReactNode }) {
  return <section className="practice-state glass" role="status"><Icon name={icon} size={40} /><h1>{title}</h1>{body && <p>{body}</p>}{children}</section>;
}

function skillLabel(skill: PracticeSkill): string {
  return SKILLS.find((entry) => entry.id === skill)?.label ?? skill;
}

function formatType(type: string): string {
  return type === 'wordReading' ? 'typed recall' : type.replace(/([A-Z])/g, ' $1').toLowerCase();
}

function formatClock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Practice is unavailable right now. Try again.';
}
