import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import {
  completedGrammarSentence,
  GRAMMAR_LEVELS,
  shuffleGrammar,
  sortGrammarByLevel,
  splitGrammarTitle,
  type GrammarLevel,
} from '../library/grammarData';
import { useCorpus, type GrammarItem } from '../library/useCorpus';
import { Icon } from '../ui/Icon';
import { GrammarTabs } from './GrammarTabs';

import '../library/grammar-library.css';

type LevelFilter = 'all' | GrammarLevel;

export function GrammarExercises() {
  const corpus = useCorpus();
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<LevelFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const corpusItems = corpus.data?.items;
  const items = useMemo(
    () => sortGrammarByLevel(corpusItems?.filter((item): item is GrammarItem => item.kind === 'grammar') ?? []),
    [corpusItems],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return items.filter((item) => (level === 'all' || item.jlpt === level) && (!needle || `${item.title} ${item.explanation} ${item.usage ?? ''}`.toLocaleLowerCase().includes(needle)));
  }, [items, level, query]);
  const active = filtered.find((item) => item.id === selectedId) ?? filtered[0] ?? null;

  function chooseLevel(next: LevelFilter) {
    setLevel(next);
    setSelectedId(null);
  }

  function nextTopic() {
    if (!active || filtered.length < 2) return;
    const index = filtered.findIndex((item) => item.id === active.id);
    setSelectedId(filtered[(index + 1) % filtered.length]?.id ?? null);
  }

  return <div className="page grammar-reference"><GrammarTabs active="exercises" />
    <section className="grammar-practice-hero glass"><div><p className="grammar-kicker">GUIDED PRACTICE</p><h1><span className="ja">練</span> Grammar exercises</h1><p>Choose a real course topic, complete its stored example, and see the curriculum explanation immediately after answering.</p></div><dl><div><dt>Available topics</dt><dd className="tabular">{corpus.isPending ? '—' : items.length}</dd></div><div><dt>Current pool</dt><dd className="tabular">{corpus.isPending ? '—' : filtered.length}</dd></div></dl></section>
    {corpus.isPending ? <div className="grammar-loading glass" role="status"><span className="ja">練</span><p>Loading grammar exercises…</p></div> : corpus.isError ? <div className="note note-error grammar-error" role="alert"><div><strong>Exercises could not be loaded.</strong><span>The course corpus is required to build real questions.</span></div><button type="button" className="btn btn-secondary btn-sm" onClick={() => void corpus.refetch()}>Try again</button></div> : items.length === 0 ? <div className="grammar-empty glass"><span className="ja">空</span><h2>No grammar exercises are available</h2><p>The current corpus contains no grammar topics.</p></div> : <>
      {corpus.data.failedUnits.length > 0 ? <p className="note grammar-partial"><strong>Partial corpus.</strong><span>Some course units did not load, so this topic picker may be incomplete.</span></p> : null}
      <div className="grammar-exercise-layout"><section className="grammar-topic-picker glass" aria-labelledby="grammar-topic-picker-heading"><div className="grammar-section-head"><div><p className="grammar-kicker">CHOOSE A TOPIC</p><h2 id="grammar-topic-picker-heading">Exercise library</h2></div><span className="tabular">{filtered.length} matching</span></div><div className="grammar-toolbar"><div className="grammar-search" role="search"><Icon name="search" size={17} /><label className="visually-hidden" htmlFor="grammar-exercise-search">Search grammar exercises</label><input id="grammar-exercise-search" type="search" value={query} onChange={(event) => { setQuery(event.target.value); setSelectedId(null); }} placeholder="Search pattern or explanation…" />{query ? <button type="button" onClick={() => setQuery('')} aria-label="Clear exercise search">×</button> : null}</div><label className="grammar-sort"><span>JLPT</span><select value={level} onChange={(event) => chooseLevel(event.target.value as LevelFilter)}><option value="all">All levels</option>{GRAMMAR_LEVELS.map((value) => <option key={value} value={value}>{value} · {items.filter((item) => item.jlpt === value).length}</option>)}</select></label></div>{filtered.length === 0 ? <div className="grammar-empty grammar-empty-inline"><span className="ja">探</span><h3>No matching exercise</h3><p>{level !== 'all' && items.every((item) => item.jlpt !== level) ? `${level} grammar topics have not been added to the course yet.` : 'Try another search or level.'}</p><button type="button" className="btn btn-secondary btn-sm" onClick={() => { setQuery(''); chooseLevel('all'); }}>Clear filters</button></div> : <ul className="grammar-topic-list">{filtered.map((item) => { const title = splitGrammarTitle(item.title); return <li key={item.id}><button type="button" className={active?.id === item.id ? 'is-active' : ''} onClick={() => setSelectedId(item.id)} aria-pressed={active?.id === item.id}><span className="ja">{title.form}</span><span><strong>{title.label}</strong><small>{item.jlpt} · {item.examples.length} example{item.examples.length === 1 ? '' : 's'}</small></span><Icon name="chevron-right" size={14} /></button></li>; })}</ul>}</section>
        <section className="grammar-exercise-studio glass" aria-live="polite">{active ? <TopicExercise key={active.id} item={active} allItems={items} onNextTopic={nextTopic} hasNext={filtered.length > 1} /> : <div className="grammar-empty"><span className="ja">問</span><h3>Select an available topic</h3><p>Choose a grammar point with a stored course example.</p></div>}</section></div>
    </>}
  </div>;
}

function TopicExercise({ item, allItems, onNextTopic, hasNext }: { item: GrammarItem; allItems: GrammarItem[]; onNextTopic: () => void; hasNext: boolean }) {
  const [exampleIndex, setExampleIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const example = item.examples[exampleIndex] ?? item.examples[0];
  const options = useMemo(() => {
    // The round counter deliberately re-runs the shuffle for "Try again".
    void round;
    if (!example) return [];
    const candidates = [...new Set(allItems.flatMap((entry) => entry.examples.map((value) => value.answer)))];
    return shuffleGrammar([example.answer, ...shuffleGrammar(candidates.filter((value) => value !== example.answer)).slice(0, 3)]);
  }, [allItems, example, round]);
  const title = splitGrammarTitle(item.title);

  function retry() {
    setSelected(null);
    setRound((value) => value + 1);
    setExampleIndex((value) => item.examples.length > 0 ? (value + 1) % item.examples.length : 0);
  }

  if (!example) return <div className="grammar-empty"><span className="ja">問</span><h3>No exercise for {title.form}</h3><p>This topic has no stored example, so a question cannot be built honestly.</p>{hasNext ? <button type="button" className="btn btn-secondary btn-sm" onClick={onNextTopic}>Next topic</button> : null}</div>;
  const correct = selected === example.answer;
  return <div className="grammar-drill"><header><div><span className="grammar-level-badge">{item.jlpt}</span><p className="grammar-kicker">CURRENT TOPIC</p><h2><b className="ja">{title.form}</b> · {title.label}</h2></div><Link to="/grammar/$id" params={{ id: item.id }}>Open details <Icon name="chevron-right" size={13} /></Link></header><div className="grammar-drill-question"><p>Choose the pattern that completes this sentence.</p><p className="ja" lang="ja">{example.sentence.replace(/＿/g, selected ?? '＿＿')}</p><span>{example.gloss}</span></div><div className="grammar-drill-options">{options.map((option) => { const showCorrect = selected !== null && option === example.answer; const showWrong = selected === option && option !== example.answer; return <button type="button" key={option} className={showCorrect ? 'is-correct' : showWrong ? 'is-wrong' : ''} onClick={() => setSelected(option)} disabled={selected !== null}><span className="ja">{option}</span>{showCorrect ? <Icon name="check" size={17} /> : null}</button>; })}</div>{selected !== null ? <div className={`grammar-drill-feedback ${correct ? 'is-correct' : 'is-wrong'}`} role="status"><div><strong>{correct ? 'Correct' : `The answer is ${example.answer}`}</strong><span className="ja">{completedGrammarSentence(example.sentence, example.answer)}</span><p>{item.explanation}</p>{item.usage ? <small><b>Usage:</b> {item.usage}</small> : null}</div><div><button type="button" className="btn btn-secondary btn-sm" onClick={retry}><Icon name="refresh-cw" size={14} /> Try again</button>{hasNext ? <button type="button" className="btn btn-primary btn-sm" onClick={onNextTopic}>Next topic <Icon name="chevron-right" size={14} /></button> : null}</div></div> : <p className="grammar-drill-hint">The options and answer come from the loaded grammar corpus.</p>}</div>;
}
