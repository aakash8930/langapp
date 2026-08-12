import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import { useKanjiBookmarks } from '../../hooks/useKanjiBookmarks';
import { Icon } from '../ui/Icon';
import { JLPT_LEVELS, sortKanjiByLevel, type JlptLevel } from '../library/kanjiData';
import { useCorpus, type KanjiItem } from '../library/useCorpus';

import '../library/kanji-library.css';

type QuizMode = 'meaning' | 'radical' | 'strokes';
type QuizLevel = 'all' | JlptLevel;
type QuizRun = { key: number; mode: QuizMode; items: KanjiItem[]; source: KanjiItem[] };
type Question = { item: KanjiItem; answer: string; options: string[] };

const MODE_COPY: Record<QuizMode, { label: string; description: string; prompt: (char: string) => string }> = {
  meaning: { label: 'Meaning', description: 'Choose the primary curriculum meaning.', prompt: (char) => `What does ${char} mean?` },
  radical: { label: 'Radical', description: 'Identify the recorded classifying radical.', prompt: (char) => `Which radical is recorded for ${char}?` },
  strokes: { label: 'Stroke count', description: 'Recall the corpus stroke count.', prompt: (char) => `How many strokes does ${char} have?` },
};

function shuffle<T>(values: T[]): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap] as T, result[index] as T];
  }
  return result;
}

function answerFor(item: KanjiItem, mode: QuizMode): string {
  if (mode === 'radical') return item.radical || 'Not provided';
  if (mode === 'strokes') return `${item.strokes}`;
  return item.meanings[0] ?? 'Not provided';
}

function createQuestions(items: KanjiItem[], source: KanjiItem[], mode: QuizMode): Question[] {
  const choices = [...new Set(source.map((item) => answerFor(item, mode)))];
  return items.map((item) => {
    const answer = answerFor(item, mode);
    const distractors = shuffle(choices.filter((choice) => choice !== answer)).slice(0, 3);
    return { item, answer, options: shuffle([answer, ...distractors]) };
  });
}

export function KanjiQuiz() {
  const corpus = useCorpus();
  const { bookmarks, isBookmarked } = useKanjiBookmarks();
  const [mode, setMode] = useState<QuizMode>('meaning');
  const [level, setLevel] = useState<QuizLevel>('all');
  const [savedOnly, setSavedOnly] = useState(false);
  const [run, setRun] = useState<QuizRun | null>(null);

  const corpusItems = corpus.data?.items;
  const allKanji = useMemo(
    () => sortKanjiByLevel(corpusItems?.filter((item): item is KanjiItem => item.kind === 'kanji') ?? []),
    [corpusItems],
  );
  const pool = useMemo(
    () => allKanji.filter((item) => (level === 'all' || item.jlpt === level) && (!savedOnly || isBookmarked(item.char))),
    [allKanji, isBookmarked, level, savedOnly],
  );

  function startQuiz() {
    if (pool.length === 0) return;
    setRun({ key: (run?.key ?? 0) + 1, mode, items: shuffle(pool).slice(0, 10), source: allKanji });
  }

  if (corpus.isPending) return <QuizFrame bookmarks={bookmarks.length}><div className="kanji-loading glass" role="status"><span className="ja">問</span><p>Preparing real kanji questions…</p></div></QuizFrame>;
  if (corpus.isError) return <QuizFrame bookmarks={bookmarks.length}><div className="kanji-empty glass"><span className="ja">問</span><h2>Quiz data could not be loaded</h2><p>Questions require the course corpus. Try again when the content API is available.</p><button type="button" className="btn btn-primary" onClick={() => void corpus.refetch()}>Try again</button></div></QuizFrame>;

  return (
    <QuizFrame bookmarks={bookmarks.length}>
      {run ? <QuizSession key={run.key} run={run} onExit={() => setRun(null)} onRestart={() => setRun({ ...run, key: run.key + 1, items: shuffle(pool).slice(0, 10) })} /> : (
        <section className="kanji-quiz-setup glass" aria-labelledby="kanji-quiz-heading">
          <div className="kanji-quiz-setup-copy"><p className="kanji-kicker">REAL CORPUS RECALL</p><h1 id="kanji-quiz-heading">Build a kanji quiz</h1><p>Choose a fact type and pool. Each run uses up to 10 available characters, with distractors drawn from real kanji values in the course.</p></div>
          <fieldset className="kanji-quiz-modes"><legend>Question type</legend>{(Object.keys(MODE_COPY) as QuizMode[]).map((value) => <label key={value} className={mode === value ? 'is-active' : ''}><input type="radio" name="kanji-quiz-mode" value={value} checked={mode === value} onChange={() => setMode(value)} /><span><Icon name={value === 'meaning' ? 'languages' : value === 'radical' ? 'layers' : 'pen-tool'} size={19} /><strong>{MODE_COPY[value].label}</strong><small>{MODE_COPY[value].description}</small></span></label>)}</fieldset>
          <div className="kanji-quiz-pool"><label><span>JLPT level</span><select value={level} onChange={(event) => setLevel(event.target.value as QuizLevel)}><option value="all">All available levels</option>{JLPT_LEVELS.map((value) => <option key={value} value={value}>{value} · {allKanji.filter((item) => item.jlpt === value).length} kanji</option>)}</select></label><label className="kanji-check"><input type="checkbox" checked={savedOnly} onChange={(event) => setSavedOnly(event.target.checked)} /><span>Bookmarks only ({bookmarks.length})</span></label></div>
          <div className="kanji-quiz-ready"><div><strong className="tabular">{pool.length}</strong><span>eligible kanji</span></div><div><strong className="tabular">{Math.min(pool.length, 10)}</strong><span>questions this run</span></div><button type="button" className="btn btn-primary" onClick={startQuiz} disabled={pool.length === 0}>Start {MODE_COPY[mode].label.toLocaleLowerCase()} quiz <Icon name="chevron-right" size={15} /></button></div>
          {pool.length === 0 ? <p className="note"><strong>No eligible kanji.</strong><span>{level !== 'all' && allKanji.every((item) => item.jlpt !== level) ? `${level} has no course kanji yet.` : savedOnly ? 'Bookmark a character or turn off the bookmark filter.' : 'No characters match this pool.'}</span></p> : null}
        </section>
      )}
    </QuizFrame>
  );
}

function QuizSession({ run, onExit, onRestart }: { run: QuizRun; onExit: () => void; onRestart: () => void }) {
  const questions = useMemo(() => createQuestions(run.items, run.source, run.mode), [run.items, run.mode, run.source]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const finished = index >= questions.length;
  const question = questions[index];

  function answer(choice: string) {
    if (!question || selected !== null) return;
    setSelected(choice);
    if (choice === question.answer) setScore((value) => value + 1);
  }

  function advance() {
    setSelected(null);
    setIndex((value) => value + 1);
  }

  if (finished) {
    const percent = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
    return <section className="kanji-quiz-result glass"><span className="kanji-quiz-result-glyph ja">答</span><p className="kanji-kicker">QUIZ COMPLETE</p><h1>{score} of {questions.length} correct</h1><p className="kanji-quiz-percent tabular">{percent}%</p><p>This score belongs to this run only. It is not saved as mastery or added to your review schedule.</p><div><button type="button" className="btn btn-primary" onClick={onRestart}><Icon name="refresh-cw" size={16} /> Try this pool again</button><button type="button" className="btn btn-secondary" onClick={onExit}>Change quiz settings</button><Link className="btn btn-secondary" to="/review">Open review queue</Link></div></section>;
  }

  if (!question) return null;
  const correct = selected === question.answer;
  return <section className="kanji-quiz-run glass" aria-labelledby="kanji-question-heading"><header><button type="button" onClick={onExit}><Icon name="chevron-left" size={15} /> End quiz</button><div className="kanji-quiz-progress"><span style={{ width: `${(index / questions.length) * 100}%` }} /><i className="visually-hidden">Question {index + 1} of {questions.length}</i></div><span className="tabular">{index + 1} / {questions.length}</span></header><div className="kanji-quiz-question"><p className="kanji-kicker">{MODE_COPY[run.mode].label.toLocaleUpperCase()} · {question.item.jlpt}</p><span className="ja" lang="ja">{question.item.char}</span><h1 id="kanji-question-heading">{MODE_COPY[run.mode].prompt(question.item.char)}</h1><div className={`kanji-quiz-options kanji-quiz-options-${run.mode}`}>{question.options.map((option) => { const showCorrect = selected !== null && option === question.answer; const showWrong = selected === option && option !== question.answer; return <button key={option} type="button" className={showCorrect ? 'is-correct' : showWrong ? 'is-wrong' : ''} onClick={() => answer(option)} disabled={selected !== null}><span className={run.mode === 'radical' ? 'ja' : ''}>{run.mode === 'strokes' ? `${option} stroke${option === '1' ? '' : 's'}` : option}</span>{showCorrect ? <Icon name="check" size={17} /> : null}</button>; })}</div>{selected !== null ? <div className={`kanji-quiz-feedback ${correct ? 'is-correct' : 'is-wrong'}`} role="status"><div><strong>{correct ? 'Correct' : 'Not quite'}</strong><span>{question.item.char} · {question.item.meanings.join(', ')} · {question.item.on.join('、') || question.item.kun.join('、')} · {question.item.strokes} strokes · radical {question.item.radical}</span></div><button type="button" className="btn btn-primary btn-sm" onClick={advance}>{index === questions.length - 1 ? 'See results' : 'Next question'} <Icon name="chevron-right" size={14} /></button></div> : <p className="kanji-quiz-hint">Choose one answer to continue.</p>}</div></section>;
}

function QuizFrame({ bookmarks, children }: { bookmarks: number; children: React.ReactNode }) {
  return <div className="page kanji-reference"><nav className="kanji-tabs glass" aria-label="Kanji sections"><Link to="/kanji"><Icon name="grid" size={16} /> Kanji list</Link><Link to="/kanji-writing"><Icon name="pen-tool" size={16} /> Writing</Link><Link className="is-active" to="/kanji-quiz" aria-current="page"><Icon name="sparkles" size={16} /> Quiz</Link><Link to="/review"><Icon name="refresh-cw" size={16} /> Review</Link><Link to="/kanji-bookmarks"><Icon name="book-marked" size={16} /> Bookmarks <span className="tabular">{bookmarks}</span></Link></nav>{children}</div>;
}
