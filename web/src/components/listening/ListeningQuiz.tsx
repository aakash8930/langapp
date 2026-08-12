import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import { useSession } from '../../useSession';
import { useCorpus, type VocabItem } from '../library/useCorpus';
import { Icon } from '../ui/Icon';
import { ListeningAudioPlayer } from './ListeningAudioPlayer';
import { LISTENING_LEVELS, shuffleListening, sortListeningItems, spokenText, type ListeningLevel } from './listeningData';
import { ListeningTabs } from './ListeningTabs';

import './listening.css';

type QuizMode = 'meaning' | 'word';
type QuizLevel = 'all' | ListeningLevel;
type QuizRun = { key: number; mode: QuizMode; items: VocabItem[]; source: VocabItem[] };
type QuizQuestion = { item: VocabItem; answer: string; options: string[] };

const MODE_COPY: Record<QuizMode, { label: string; description: string }> = {
  meaning: { label: 'Audio to meaning', description: 'Hear the Japanese reading and choose its English meaning.' },
  word: { label: 'Audio to word', description: 'Hear the reading and choose the matching Japanese word.' },
};

function makeQuestions(items: VocabItem[], source: VocabItem[], mode: QuizMode): QuizQuestion[] {
  const values = [...new Set(source.map((item) => mode === 'meaning' ? item.gloss : item.lemma))];
  return items.map((item) => {
    const answer = mode === 'meaning' ? item.gloss : item.lemma;
    return { item, answer, options: shuffleListening([answer, ...shuffleListening(values.filter((value) => value !== answer)).slice(0, 3)]) };
  });
}

export function ListeningQuiz() {
  const corpus = useCorpus();
  const { session } = useSession();
  const [speed, setSpeed] = useState(session.state === 'signedIn' ? session.user.settings.audioSpeed : 1);
  const [mode, setMode] = useState<QuizMode>('meaning');
  const [level, setLevel] = useState<QuizLevel>('all');
  const [run, setRun] = useState<QuizRun | null>(null);
  const corpusItems = corpus.data?.items;
  const items = useMemo(() => sortListeningItems(corpusItems?.filter((item): item is VocabItem => item.kind === 'vocab') ?? []), [corpusItems]);
  const pool = useMemo(() => items.filter((item) => level === 'all' || item.jlpt === level), [items, level]);

  function startQuiz() {
    if (pool.length === 0) return;
    setRun({ key: (run?.key ?? 0) + 1, mode, items: shuffleListening(pool).slice(0, 10), source: items });
  }

  return <div className="page listening-reference"><ListeningTabs active="quiz" />{corpus.data && corpus.data.failedUnits.length > 0 && items.length > 0 ? <p className="note listening-partial"><strong>Some units are missing.</strong><span>{corpus.data.failedUnits.length} course unit{corpus.data.failedUnits.length === 1 ? '' : 's'} could not be loaded, so this quiz pool is incomplete.</span></p> : null}{corpus.isPending ? <div className="listening-loading glass" role="status"><Icon name="headphones" size={42} /><p>Preparing listening questions…</p></div> : corpus.isError ? <div className="listening-empty glass"><span className="ja">問</span><h2>Quiz data could not be loaded</h2><p>Questions require the course corpus. Try again when the content API is available.</p><button type="button" className="btn btn-primary" onClick={() => void corpus.refetch()}>Try again</button></div> : items.length === 0 ? <div className="listening-empty glass"><span className="ja">空</span><h2>{corpus.data.failedUnits.length > 0 ? 'No quiz questions could be loaded' : 'No listening questions are available'}</h2><p>{corpus.data.failedUnits.length > 0 ? `${corpus.data.failedUnits.length} course unit${corpus.data.failedUnits.length === 1 ? '' : 's'} failed to load. Try again when the content API is fully available.` : 'The current corpus contains no vocabulary for a listening quiz.'}</p>{corpus.data.failedUnits.length > 0 ? <button type="button" className="btn btn-primary" onClick={() => void corpus.refetch()}>Try again</button> : null}</div> : run ? <ListeningQuizSession key={run.key} run={run} speed={speed} onSpeedChange={setSpeed} onExit={() => setRun(null)} onRestart={() => setRun({ ...run, key: run.key + 1, items: shuffleListening(pool).slice(0, 10) })} /> : <section className="listening-quiz-setup glass" aria-labelledby="listening-quiz-heading"><div className="listening-quiz-setup-copy"><p className="listening-kicker">AUDIO RECOGNITION</p><h1 id="listening-quiz-heading">Build a listening quiz</h1><p>Choose what you want to recognise. Every prompt uses a real course reading, and every option comes from the loaded vocabulary corpus.</p></div><fieldset className="listening-quiz-modes"><legend>Question type</legend>{(Object.keys(MODE_COPY) as QuizMode[]).map((value) => <label key={value} className={mode === value ? 'is-active' : ''}><input type="radio" name="listening-quiz-mode" checked={mode === value} onChange={() => setMode(value)} /><span><Icon name={value === 'meaning' ? 'languages' : 'captions'} size={19} /><strong>{MODE_COPY[value].label}</strong><small>{MODE_COPY[value].description}</small></span></label>)}</fieldset><div className="listening-quiz-pool"><label><span>JLPT level</span><select value={level} onChange={(event) => setLevel(event.target.value as QuizLevel)}><option value="all">All available levels</option>{LISTENING_LEVELS.map((value) => <option key={value} value={value}>{value} · {items.filter((item) => item.jlpt === value).length} lessons</option>)}</select></label><label><span>Starting speed</span><select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}><option value={0.5}>0.5×</option><option value={0.75}>0.75×</option><option value={1}>1×</option><option value={1.25}>1.25×</option><option value={1.5}>1.5×</option><option value={2}>2×</option></select></label></div><div className="listening-quiz-ready"><div><strong className="tabular">{pool.length}</strong><span>eligible lessons</span></div><div><strong className="tabular">{Math.min(pool.length, 10)}</strong><span>questions this run</span></div><button type="button" className="btn btn-primary" onClick={startQuiz} disabled={pool.length === 0}>Start listening quiz <Icon name="chevron-right" size={15} /></button></div>{pool.length === 0 ? <p className="note"><strong>No eligible lessons.</strong><span>{level !== 'all' && items.every((item) => item.jlpt !== level) ? `${level} has no course listening vocabulary yet.` : 'The selected pool is empty.'}</span></p> : null}</section>}</div>;
}

function ListeningQuizSession({ run, speed, onSpeedChange, onExit, onRestart }: { run: QuizRun; speed: number; onSpeedChange: (speed: number) => void; onExit: () => void; onRestart: () => void }) {
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
    return <section className="listening-quiz-result glass"><span className="listening-quiz-result-glyph ja">聴</span><p className="listening-kicker">QUIZ COMPLETE</p><h1>{score} of {questions.length} correct</h1><p className="listening-quiz-percent tabular">{percent}%</p><p>This result belongs to this run only. It is not saved as listening mastery or added to the review schedule.</p><div><button type="button" className="btn btn-primary" onClick={onRestart}><Icon name="refresh-cw" size={16} /> Try this pool again</button><button type="button" className="btn btn-secondary" onClick={onExit}>Change quiz settings</button><Link className="btn btn-secondary" to="/review">Open review queue</Link></div></section>;
  }
  if (!question) return null;
  const correct = selected === question.answer;
  return <section className="listening-quiz-run glass" aria-labelledby="listening-question-heading"><header><button type="button" onClick={onExit}><Icon name="chevron-left" size={15} /> End quiz</button><div className="listening-quiz-progress" role="progressbar" aria-label="Quiz progress" aria-valuemin={1} aria-valuemax={questions.length} aria-valuenow={index + 1}><span style={{ width: `${((index + 1) / questions.length) * 100}%` }} /><i className="visually-hidden">Question {index + 1} of {questions.length}</i></div><span className="tabular">{index + 1} / {questions.length}</span></header><div className="listening-quiz-question"><p className="listening-kicker">{MODE_COPY[run.mode].label.toLocaleUpperCase()} · {question.item.jlpt}</p><h1 id="listening-question-heading">Listen, then choose the {run.mode === 'meaning' ? 'meaning' : 'Japanese word'}.</h1><ListeningAudioPlayer itemId={question.item.id} text={spokenText(question.item)} speed={speed} onSpeedChange={onSpeedChange} revealText={selected !== null} /><div className={`listening-quiz-options listening-quiz-options-${run.mode}`}>{question.options.map((option) => { const showCorrect = selected !== null && option === question.answer; const showWrong = selected === option && option !== question.answer; return <button key={option} type="button" className={showCorrect ? 'is-correct' : showWrong ? 'is-wrong' : ''} onClick={() => choose(option)} disabled={selected !== null}><span className={run.mode === 'word' ? 'ja' : ''} lang={run.mode === 'word' ? 'ja' : undefined}>{option}</span>{showCorrect ? <Icon name="check" size={17} /> : null}</button>; })}</div>{selected !== null ? <div className={`listening-quiz-feedback ${correct ? 'is-correct' : 'is-wrong'}`} role="status"><div><strong>{correct ? 'Correct' : 'Not quite'}</strong><span><b className="ja" lang="ja">{question.item.lemma}</b> · <span className="ja" lang="ja">{question.item.reading}</span> · {question.item.gloss}</span>{question.item.romaji ? <small>{question.item.romaji}</small> : null}</div><button type="button" className="btn btn-primary btn-sm" onClick={advance}>{index === questions.length - 1 ? 'See results' : 'Next question'} <Icon name="chevron-right" size={14} /></button></div> : <p className="listening-quiz-hint">The transcript and translation stay hidden until you answer.</p>}</div></section>;
}
