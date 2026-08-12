import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import { Icon } from '../ui/Icon';
import { useCorpus, type GrammarItem, type VocabItem } from '../library/useCorpus';
import { buildReadingEntries, readingKindLabel } from './readingData';
import { ReadingTabs } from './ReadingTabs';
import { useReadingStats } from './useReadingStats';

import './reading.css';

function stableChoiceIndexes(correctIndex: number, total: number): number[] {
  const indexes = [correctIndex];
  let offset = 1;
  while (indexes.length < Math.min(4, total)) {
    const candidate = (correctIndex + offset * 7) % total;
    if (!indexes.includes(candidate)) indexes.push(candidate);
    offset += 1;
  }
  return indexes.sort((left, right) => ((left * 17 + correctIndex) % 11) - ((right * 17 + correctIndex) % 11));
}

export function ReadingQuiz() {
  const corpus = useCorpus();
  const { recordQuizAnswer, summary, stats } = useReadingStats();
  const corpusItems = corpus.data?.items;
  const vocab = useMemo(() => corpusItems?.filter((item): item is VocabItem => item.kind === 'vocab') ?? [], [corpusItems]);
  const grammar = useMemo(() => corpusItems?.filter((item): item is GrammarItem => item.kind === 'grammar') ?? [], [corpusItems]);
  const entries = useMemo(() => {
    const seen = new Set<string>();
    return buildReadingEntries(vocab, grammar).filter((entry) => {
      const normalized = entry.translation.trim().toLocaleLowerCase();
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
  }, [grammar, vocab]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const question = entries.length > 0 ? entries[questionIndex % entries.length] : undefined;
  const choices = useMemo(() => question ? stableChoiceIndexes(questionIndex % entries.length, entries.length).map((index) => entries[index]) : [], [entries, question, questionIndex]);
  const correct = Boolean(checked && question && choice === question.translation);

  function checkAnswer() {
    if (!question || !choice || checked) return;
    const isCorrect = choice === question.translation;
    recordQuizAnswer(isCorrect);
    setChecked(true);
  }

  function nextQuestion() {
    setQuestionIndex((index) => index + 1);
    setChoice(null);
    setChecked(false);
  }

  if (corpus.isPending) return <QuizShell><div className="reading-loading glass" role="status"><Icon name="brain" size={38} /><p>Preparing a check from the course corpus…</p></div></QuizShell>;
  if (corpus.isError) return <QuizShell><section className="reading-empty glass"><Icon name="wifi-off" size={40} /><h2>Comprehension check unavailable</h2><p>The course corpus could not be loaded. No fallback questions are invented.</p><button type="button" className="btn btn-secondary" onClick={() => void corpus.refetch()}>Try again</button></section></QuizShell>;
  if (!question || choices.length < 2) return <QuizShell><section className="reading-empty glass"><Icon name="brain" size={40} /><h2>Not enough eligible content</h2><p>The check needs at least two corpus entries with distinct authored meanings.</p><Link className="btn btn-primary" to="/reading-library">Return to library</Link></section></QuizShell>;

  return <QuizShell><header className="reading-page-header"><div><p className="reading-kicker">CORPUS-BASED PRACTICE</p><h1>Comprehension Check</h1><p>Read first, then choose the stored English meaning. Translations stay hidden until you answer.</p></div><div className="reading-quiz-score"><span>Local outcomes</span><strong>{stats.quizAnswered > 0 ? `${summary.quizAccuracy}%` : '—'}</strong><small>{stats.quizAnswered} answered</small></div></header><div className="reading-quiz-layout"><main className="reading-quiz-card glass"><div className="reading-quiz-progress"><span>Question <strong className="tabular">{questionIndex + 1}</strong></span><span>{readingKindLabel(question.kind)} · {question.jlpt}</span></div><p className="reading-kicker">WHAT DOES THIS MEAN?</p><h2 className="ja" lang="ja">{question.sentence}</h2>{question.reading && question.reading !== question.sentence ? <p className="reading-quiz-reading ja" lang="ja">{question.reading}</p> : null}<fieldset disabled={checked}><legend className="sr-only">Choose the stored English meaning</legend>{choices.map((candidate, index) => { const isChosen = choice === candidate.translation; const isAnswer = checked && candidate.translation === question.translation; const isWrong = checked && isChosen && !isAnswer; return <label className={`${isChosen ? 'is-selected' : ''} ${isAnswer ? 'is-correct' : ''} ${isWrong ? 'is-wrong' : ''}`} key={`${question.id}-${candidate.id}`}><input type="radio" name="reading-answer" value={candidate.translation} checked={isChosen} onChange={() => setChoice(candidate.translation)} /><span>{String.fromCharCode(65 + index)}</span><strong>{candidate.translation}</strong>{isAnswer ? <Icon name="check" size={17} /> : isWrong ? <Icon name="x" size={17} /> : null}</label>; })}</fieldset>{checked ? <div className={`reading-quiz-result ${correct ? 'is-correct' : 'is-wrong'}`} role="status"><Icon name={correct ? 'check-circle-2' : 'circle-alert'} size={21} /><div><strong>{correct ? 'Correct' : 'Not quite'}</strong><p>The stored meaning is: {question.translation}</p></div></div> : null}<div className="reading-quiz-actions">{checked ? <button type="button" className="btn btn-primary" onClick={nextQuestion}>Next question <Icon name="arrow-right" size={15} /></button> : <button type="button" className="btn btn-primary" onClick={checkAnswer} disabled={!choice}>Check answer</button>}<Link className="btn btn-secondary" to="/reading/$id" params={{ id: question.id }}>Open in reader</Link></div></main><aside className="reading-quiz-aside glass"><p className="reading-kicker">WHAT THIS MEASURES</p><h2>A focused translation check</h2><p>Every prompt and answer comes from current course vocabulary, stored examples, or completed grammar examples.</p><ul><li><Icon name="check" size={15} /> Answers recorded only after submission</li><li><Icon name="check" size={15} /> Outcomes saved in this browser</li><li><Icon name="x" size={15} /> No invented article questions</li><li><Icon name="x" size={15} /> No claim of full reading mastery</li></ul><Link to="/reading-statistics">View reading statistics <Icon name="arrow-right" size={14} /></Link></aside></div></QuizShell>;
}

function QuizShell({ children }: { children: React.ReactNode }) {
  return <div className="page reading-reference"><ReadingTabs active="quiz" />{children}</div>;
}
