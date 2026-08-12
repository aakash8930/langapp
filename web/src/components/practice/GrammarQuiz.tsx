import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import {
  completedGrammarSentence,
  GRAMMAR_LEVELS,
  shuffleGrammar,
  sortGrammarByLevel,
  type GrammarLevel,
} from '../library/grammarData';
import { useCorpus, type GrammarItem } from '../library/useCorpus';
import { Icon } from '../ui/Icon';
import { GrammarTabs } from './GrammarTabs';

import '../library/grammar-library.css';

type QuizMode = 'fill' | 'identify';
type QuizLevel = 'all' | GrammarLevel;
type QuizRun = { key: number; mode: QuizMode; items: GrammarItem[]; source: GrammarItem[] };
type QuizQuestion = { item: GrammarItem; prompt: string; context: string; answer: string; options: string[] };

const MODE_COPY: Record<QuizMode, { label: string; description: string }> = {
  fill: { label: 'Fill the blank', description: 'Choose the form that completes a real course sentence.' },
  identify: { label: 'Identify the topic', description: 'Match a curriculum explanation to its grammar title.' },
};

function makeQuestions(items: GrammarItem[], source: GrammarItem[], mode: QuizMode): QuizQuestion[] {
  if (mode === 'identify') {
    const titles = [...new Set(source.map((item) => item.title))];
    return items.map((item) => ({
      item,
      prompt: item.explanation,
      context: 'Which grammar topic does this explanation describe?',
      answer: item.title,
      options: shuffleGrammar([item.title, ...shuffleGrammar(titles.filter((title) => title !== item.title)).slice(0, 3)]),
    }));
  }

  const answers = [...new Set(source.flatMap((item) => item.examples.map((example) => example.answer)))];
  return items.flatMap((item) => {
    const example = item.examples[0];
    if (!example) return [];
    return [{
      item,
      prompt: example.sentence,
      context: example.gloss,
      answer: example.answer,
      options: shuffleGrammar([example.answer, ...shuffleGrammar(answers.filter((answer) => answer !== example.answer)).slice(0, 3)]),
    }];
  });
}

export function GrammarQuiz() {
  const corpus = useCorpus();
  const [mode, setMode] = useState<QuizMode>('fill');
  const [level, setLevel] = useState<QuizLevel>('all');
  const [run, setRun] = useState<QuizRun | null>(null);
  const corpusItems = corpus.data?.items;
  const items = useMemo(
    () => sortGrammarByLevel(corpusItems?.filter((item): item is GrammarItem => item.kind === 'grammar') ?? []),
    [corpusItems],
  );
  const pool = useMemo(() => items.filter((item) => (level === 'all' || item.jlpt === level) && (mode !== 'fill' || item.examples.length > 0)), [items, level, mode]);

  function startQuiz() {
    if (pool.length === 0) return;
    setRun({ key: (run?.key ?? 0) + 1, mode, items: shuffleGrammar(pool).slice(0, 10), source: items });
  }

  return <div className="page grammar-reference"><GrammarTabs active="quiz" />
    {corpus.isPending ? <div className="grammar-loading glass" role="status"><span className="ja">問</span><p>Preparing real grammar questions…</p></div> : corpus.isError ? <div className="grammar-empty glass"><span className="ja">問</span><h2>Quiz data could not be loaded</h2><p>Questions require the course corpus. Try again when the content API is available.</p><button type="button" className="btn btn-primary" onClick={() => void corpus.refetch()}>Try again</button></div> : run ? <GrammarQuizSession key={run.key} run={run} onExit={() => setRun(null)} onRestart={() => setRun({ ...run, key: run.key + 1, items: shuffleGrammar(pool).slice(0, 10) })} /> : <section className="grammar-quiz-setup glass" aria-labelledby="grammar-quiz-heading"><div className="grammar-quiz-setup-copy"><p className="grammar-kicker">COURSE-BACKED RECALL</p><h1 id="grammar-quiz-heading">Build a grammar quiz</h1><p>Choose a question style and JLPT pool. Each run uses up to 10 real topics and only curriculum answers as distractors.</p></div><fieldset className="grammar-quiz-modes"><legend>Question type</legend>{(Object.keys(MODE_COPY) as QuizMode[]).map((value) => <label key={value} className={mode === value ? 'is-active' : ''}><input type="radio" name="grammar-quiz-mode" checked={mode === value} onChange={() => setMode(value)} /><span><Icon name={value === 'fill' ? 'pen-square' : 'book-open'} size={19} /><strong>{MODE_COPY[value].label}</strong><small>{MODE_COPY[value].description}</small></span></label>)}</fieldset><div className="grammar-quiz-pool"><label><span>JLPT level</span><select value={level} onChange={(event) => setLevel(event.target.value as QuizLevel)}><option value="all">All available levels</option>{GRAMMAR_LEVELS.map((value) => <option key={value} value={value}>{value} · {items.filter((item) => item.jlpt === value).length} topics</option>)}</select></label></div><div className="grammar-quiz-ready"><div><strong className="tabular">{pool.length}</strong><span>eligible topics</span></div><div><strong className="tabular">{Math.min(pool.length, 10)}</strong><span>questions this run</span></div><button type="button" className="btn btn-primary" onClick={startQuiz} disabled={pool.length === 0}>Start {MODE_COPY[mode].label.toLocaleLowerCase()} quiz <Icon name="chevron-right" size={15} /></button></div>{pool.length === 0 ? <p className="note"><strong>No eligible topics.</strong><span>{level !== 'all' && items.every((item) => item.jlpt !== level) ? `${level} has no course grammar yet.` : 'This pool has no examples for the selected question style.'}</span></p> : null}</section>}
  </div>;
}

function GrammarQuizSession({ run, onExit, onRestart }: { run: QuizRun; onExit: () => void; onRestart: () => void }) {
  const questions = useMemo(() => makeQuestions(run.items, run.source, run.mode), [run.items, run.mode, run.source]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const question = questions[index];

  function choose(option: string) {
    if (!question || selected !== null) return;
    setSelected(option);
    if (option === question.answer) setScore((value) => value + 1);
  }

  function advance() {
    setSelected(null);
    setIndex((value) => value + 1);
  }

  if (index >= questions.length) {
    const percent = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
    return <section className="grammar-quiz-result glass"><span className="grammar-quiz-result-glyph ja">答</span><p className="grammar-kicker">QUIZ COMPLETE</p><h1>{score} of {questions.length} correct</h1><p className="grammar-quiz-percent tabular">{percent}%</p><p>This result describes this quiz run only. It is not saved as grammar mastery or added to the review schedule.</p><div><button type="button" className="btn btn-primary" onClick={onRestart}><Icon name="refresh-cw" size={16} /> Try this pool again</button><button type="button" className="btn btn-secondary" onClick={onExit}>Change quiz settings</button><Link className="btn btn-secondary" to="/review">Open review queue</Link></div></section>;
  }
  if (!question) return null;
  const correct = selected === question.answer;
  return <section className="grammar-quiz-run glass" aria-labelledby="grammar-question-heading"><header><button type="button" onClick={onExit}><Icon name="chevron-left" size={15} /> End quiz</button><div className="grammar-quiz-progress"><span style={{ width: `${(index / questions.length) * 100}%` }} /><i className="visually-hidden">Question {index + 1} of {questions.length}</i></div><span className="tabular">{index + 1} / {questions.length}</span></header><div className="grammar-quiz-question"><p className="grammar-kicker">{MODE_COPY[run.mode].label.toLocaleUpperCase()} · {question.item.jlpt}</p>{run.mode === 'fill' ? <p className="grammar-quiz-sentence ja" lang="ja">{question.prompt.replace(/＿/g, selected ?? '＿＿')}</p> : <p className="grammar-quiz-explanation">{question.prompt}</p>}<h1 id="grammar-question-heading">{question.context}</h1><div className={`grammar-quiz-options grammar-quiz-options-${run.mode}`}>{question.options.map((option) => { const showCorrect = selected !== null && option === question.answer; const showWrong = selected === option && option !== question.answer; return <button key={option} type="button" className={showCorrect ? 'is-correct' : showWrong ? 'is-wrong' : ''} onClick={() => choose(option)} disabled={selected !== null}><span className={run.mode === 'fill' ? 'ja' : ''}>{option}</span>{showCorrect ? <Icon name="check" size={17} /> : null}</button>; })}</div>{selected !== null ? <div className={`grammar-quiz-feedback ${correct ? 'is-correct' : 'is-wrong'}`} role="status"><div><strong>{correct ? 'Correct' : 'Not quite'}</strong><span>{run.mode === 'fill' && question.item.examples[0] ? completedGrammarSentence(question.item.examples[0].sentence, question.item.examples[0].answer) : question.item.title}</span><p>{question.item.explanation}</p></div><button type="button" className="btn btn-primary btn-sm" onClick={advance}>{index === questions.length - 1 ? 'See results' : 'Next question'} <Icon name="chevron-right" size={14} /></button></div> : <p className="grammar-quiz-hint">Choose one answer to continue.</p>}</div></section>;
}
