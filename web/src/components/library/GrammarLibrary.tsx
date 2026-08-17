import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import { Icon } from '../ui/Icon';
import {
  completedGrammarSentence,
  grammarLevelRank,
  GRAMMAR_LEVELS,
  sortGrammarByLevel,
  splitGrammarTitle,
  type GrammarLevel,
} from './grammarData';
import { useCorpus, type GrammarItem } from './useCorpus';

import './grammar-library.css';

type LevelFilter = 'all' | GrammarLevel;
type ContentFilter = 'all' | 'usage' | 'mistakes';
type SortMode = 'level' | 'title' | 'examples';

const PAGE_SIZE = 18;
const LEVEL_COPY: Record<GrammarLevel, { label: string; note: string }> = {
  N5: { label: 'Beginner', note: 'Core sentence building' },
  N4: { label: 'Elementary', note: 'Everyday structures' },
  N3: { label: 'Intermediate', note: 'Connected expression' },
  N2: { label: 'Advanced', note: 'Formal and nuanced usage' },
  N1: { label: 'Expert', note: 'High-level comprehension' },
};

function scrollToGrammarList() {
  window.requestAnimationFrame(() => {
    document.getElementById('grammar-list')?.scrollIntoView({
      block: 'start',
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  });
}

export function GrammarLibrary() {
  const corpus = useCorpus();
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<LevelFilter>('all');
  const [content, setContent] = useState<ContentFilter>('all');
  const [sort, setSort] = useState<SortMode>('level');
  const [page, setPage] = useState(0);
  const corpusItems = corpus.data?.items;
  const items = useMemo(
    () => sortGrammarByLevel(corpusItems?.filter((item): item is GrammarItem => item.kind === 'grammar') ?? []),
    [corpusItems],
  );
  const levelCounts = Object.fromEntries(GRAMMAR_LEVELS.map((value) => [value, items.filter((item) => item.jlpt === value).length])) as Record<GrammarLevel, number>;
  const exampleCount = items.reduce((total, item) => total + item.examples.length, 0);
  const usageCount = items.filter((item) => Boolean(item.usage)).length;
  const mistakeCount = items.reduce((total, item) => total + item.commonMistakes.length, 0);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    let result = items.filter((item) => {
      if (level !== 'all' && item.jlpt !== level) return false;
      if (content === 'usage' && !item.usage) return false;
      if (content === 'mistakes' && item.commonMistakes.length === 0) return false;
      if (!needle) return true;
      return `${item.title} ${item.explanation} ${item.usage ?? ''} ${item.examples.map((example) => `${example.sentence} ${example.answer} ${example.romaji ?? ''} ${example.gloss}`).join(' ')} ${item.commonMistakes.map((mistake) => `${mistake.mistake} ${mistake.correction} ${mistake.note}`).join(' ')}`
        .toLocaleLowerCase()
        .includes(needle);
    });
    if (sort === 'title') result = [...result].sort((left, right) => left.title.localeCompare(right.title, 'ja'));
    if (sort === 'examples') result = [...result].sort((left, right) => right.examples.length - left.examples.length || grammarLevelRank(left.jlpt) - grammarLevelRank(right.jlpt));
    return result;
  }, [content, items, level, query, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const shown = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  function chooseLevel(next: LevelFilter, reveal = false) {
    setLevel(next);
    setPage(0);
    if (reveal) scrollToGrammarList();
  }

  function clearFilters() {
    setQuery('');
    setLevel('all');
    setContent('all');
    setSort('level');
    setPage(0);
  }

  function changePage(next: number) {
    setPage(Math.max(0, Math.min(next, pageCount - 1)));
    scrollToGrammarList();
  }

  return (
    <div className="page grammar-reference">
      <section className="grammar-hero glass">
        <div className="grammar-hero-copy"><p className="grammar-kicker">JAPANESE GRAMMAR LIBRARY</p><h1><span className="ja" aria-hidden="true">文</span> Grammar</h1><p>Learn how Japanese sentences fit together through real curriculum explanations, usage notes, worked examples, common mistakes, and practice.</p><div className="grammar-hero-actions"><button type="button" className="btn btn-primary" onClick={scrollToGrammarList}>Browse grammar <Icon name="chevron-down" size={16} /></button><Link className="btn btn-secondary" to="/grammar-quiz">Start grammar quiz</Link></div></div>
        <div className="grammar-hero-pattern" aria-hidden="true"><span className="ja">文法</span><small>ぶんぽう · bunpō · grammar</small></div>
        <dl className="grammar-hero-metrics"><div><dt>Course topics</dt><dd className="tabular">{corpus.isPending ? '—' : items.length}</dd></div><div><dt>Worked examples</dt><dd className="tabular">{corpus.isPending ? '—' : exampleCount}</dd></div><div><dt>Usage notes</dt><dd className="tabular">{corpus.isPending ? '—' : usageCount}</dd></div><div><dt>Documented mistakes</dt><dd className="tabular">{corpus.isPending ? '—' : mistakeCount}</dd></div></dl>
      </section>

      <nav className="grammar-tabs glass" aria-label="Grammar sections"><Link className="is-active" to="/grammar" aria-current="page"><Icon name="grid" size={16} /> Grammar list</Link><Link to="/grammar-exercises"><Icon name="pen-square" size={16} /> Exercises</Link><Link to="/grammar-quiz"><Icon name="sparkles" size={16} /> Quiz</Link><Link to="/practice-hub"><Icon name="refresh-cw" size={16} /> Practice</Link></nav>

      {corpus.isPending ? <div className="grammar-loading glass" role="status"><span className="ja">文</span><p>Loading the grammar curriculum…</p></div> : corpus.isError ? <div className="note note-error grammar-error" role="alert"><div><strong>The grammar library could not be loaded.</strong><span>The content API may be asleep. Try again when it is available.</span></div><button type="button" className="btn btn-secondary btn-sm" onClick={() => void corpus.refetch()}>Try again</button></div> : items.length === 0 ? <div className="grammar-empty glass"><span className="ja">空</span><h2>No grammar topics are available</h2><p>The server returned a curriculum without grammar content.</p></div> : <>
        {corpus.data.failedUnits.length > 0 ? <p className="note grammar-partial"><strong>Some units are missing.</strong><span>{corpus.data.failedUnits.length} course unit{corpus.data.failedUnits.length === 1 ? '' : 's'} could not be loaded, so this list is incomplete.</span></p> : null}

        <section className="grammar-level-path glass" aria-labelledby="grammar-level-heading"><div className="grammar-section-head"><div><p className="grammar-kicker">BEGINNER TO ADVANCED</p><h2 id="grammar-level-heading">Grammar by JLPT level</h2></div><button type="button" className={level === 'all' ? 'is-active' : ''} onClick={() => chooseLevel('all')}>Show all levels</button></div><ol>{GRAMMAR_LEVELS.map((value, index) => <li key={value}><button type="button" className={level === value ? 'is-active' : ''} onClick={() => chooseLevel(value, true)} aria-pressed={level === value}><span className={`grammar-level-badge grammar-level-${value.toLocaleLowerCase()}`}>{value}</span><span><strong>{LEVEL_COPY[value].label}</strong><small>{LEVEL_COPY[value].note}</small></span><span className="tabular">{levelCounts[value]} topic{levelCounts[value] === 1 ? '' : 's'}</span><i aria-hidden="true">{String(index + 1).padStart(2, '0')}</i></button></li>)}</ol>{GRAMMAR_LEVELS.some((value) => levelCounts[value] === 0) ? <p className="grammar-level-note"><Icon name="check" size={13} /> Levels without curriculum topics remain visible and honestly empty.</p> : null}</section>

        <div className="grammar-layout">
          <main className="grammar-main"><section className="grammar-library glass" id="grammar-list" aria-labelledby="grammar-list-heading"><div className="grammar-section-head"><div><p className="grammar-kicker">TOPIC INDEX</p><h2 id="grammar-list-heading">Grammar list</h2></div><span className="tabular" role="status">{filtered.length} matching topic{filtered.length === 1 ? '' : 's'}</span></div>
            <div className="grammar-toolbar"><div className="grammar-search" role="search"><Icon name="search" size={17} /><label className="visually-hidden" htmlFor="grammar-search">Search grammar by pattern, explanation, usage, or example</label><input id="grammar-search" type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Search pattern, explanation, or example…" />{query ? <button type="button" onClick={() => { setQuery(''); setPage(0); }} aria-label="Clear grammar search">×</button> : null}</div><label className="grammar-sort"><span>Sort</span><select value={sort} onChange={(event) => { setSort(event.target.value as SortMode); setPage(0); }}><option value="level">N5 → N1</option><option value="title">Pattern</option><option value="examples">Most examples</option></select></label></div>
            <div className="grammar-filters" aria-label="Grammar filters"><label><span>JLPT</span><select value={level} onChange={(event) => chooseLevel(event.target.value as LevelFilter)}><option value="all">All levels</option>{GRAMMAR_LEVELS.map((value) => <option key={value} value={value}>{value} · {LEVEL_COPY[value].label} ({levelCounts[value]})</option>)}</select></label><label><span>Content</span><select value={content} onChange={(event) => { setContent(event.target.value as ContentFilter); setPage(0); }}><option value="all">All topics</option><option value="usage">With usage notes</option><option value="mistakes">With common mistakes</option></select></label>{query || level !== 'all' || content !== 'all' || sort !== 'level' ? <button type="button" className="grammar-clear" onClick={clearFilters}>Clear all</button> : null}</div>
            {filtered.length === 0 ? <div className="grammar-empty grammar-empty-inline"><span className="ja">探</span><h3>No matching grammar</h3><p>{level !== 'all' && levelCounts[level] === 0 ? `${level} grammar topics have not been added to the course yet.` : 'Try another pattern, explanation, level, or content filter.'}</p><button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>Clear search and filters</button></div> : <><ul className="grammar-card-grid">{shown.map((item) => <GrammarCard key={item.id} item={item} />)}</ul><div className="grammar-pagination"><p className="tabular">Showing {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</p><div><button type="button" onClick={() => changePage(safePage - 1)} disabled={safePage === 0}><Icon name="chevron-left" size={15} /> Previous</button><span className="tabular">Page {safePage + 1} of {pageCount}</span><button type="button" onClick={() => changePage(safePage + 1)} disabled={safePage >= pageCount - 1}>Next <Icon name="chevron-right" size={15} /></button></div></div></>}
          </section></main>
          <GrammarSidebar items={items} levelCounts={levelCounts} exampleCount={exampleCount} usageCount={usageCount} mistakeCount={mistakeCount} onChooseLevel={(next) => chooseLevel(next, true)} />
        </div>
      </>}
    </div>
  );
}

function GrammarCard({ item }: { item: GrammarItem }) {
  const title = splitGrammarTitle(item.title);
  const example = item.examples[0];
  return <li><article className="grammar-card"><Link to="/grammar/$id" params={{ id: item.id }}><div className="grammar-card-top"><span className={`grammar-level-badge grammar-level-${item.jlpt.toLocaleLowerCase()}`}>{item.jlpt}</span><span>{item.examples.length} example{item.examples.length === 1 ? '' : 's'}</span></div><div className="grammar-card-title"><span className="ja" lang="ja">{title.form}</span><div><h3>{title.label}</h3><small>{item.title}</small></div></div><p className="grammar-card-explanation">{item.explanation}</p>{example ? <div className="grammar-card-example"><small>EXAMPLE</small><p className="ja">{completedGrammarSentence(example.sentence, example.answer)}</p><span>{example.gloss}</span></div> : <div className="grammar-card-example grammar-card-no-example"><small>NO EXAMPLE STORED</small></div>}<div className="grammar-card-meta"><span>{item.usage ? <Icon name="check" size={13} /> : null}{item.usage ? 'Usage note' : 'No usage note'}</span><span className="tabular">{item.commonMistakes.length} documented mistake{item.commonMistakes.length === 1 ? '' : 's'}</span></div><span className="grammar-card-open">Open grammar detail <Icon name="chevron-right" size={14} /></span></Link></article></li>;
}

function GrammarSidebar({ items, levelCounts, exampleCount, usageCount, mistakeCount, onChooseLevel }: { items: GrammarItem[]; levelCounts: Record<GrammarLevel, number>; exampleCount: number; usageCount: number; mistakeCount: number; onChooseLevel: (level: GrammarLevel) => void }) {
  return <aside className="grammar-rail" aria-label="Grammar study tools"><section className="grammar-rail-card glass" aria-labelledby="grammar-practice-heading"><div className="grammar-rail-head"><div><p className="grammar-kicker">QUICK PRACTICE</p><h2 id="grammar-practice-heading">Use the patterns</h2></div><span><Icon name="sparkles" size={19} /></span></div><ul className="grammar-action-list"><li><Link to="/grammar-exercises"><span><Icon name="pen-square" size={17} /></span><span><strong>Grammar exercises</strong><small>Practise with immediate feedback</small></span><Icon name="chevron-right" size={14} /></Link></li><li><Link to="/grammar-quiz"><span><Icon name="sparkles" size={17} /></span><span><strong>Grammar quiz</strong><small>Test up to 10 real topics</small></span><Icon name="chevron-right" size={14} /></Link></li><li><Link to="/practice-hub"><span><Icon name="refresh-cw" size={17} /></span><span><strong>Practice hub</strong><small>Use course-backed exercises</small></span><Icon name="chevron-right" size={14} /></Link></li></ul></section>
    <section className="grammar-rail-card glass" aria-labelledby="grammar-coverage-heading"><div className="grammar-rail-head"><div><p className="grammar-kicker">COURSE COVERAGE</p><h2 id="grammar-coverage-heading">Available by level</h2></div></div><ul className="grammar-coverage-list">{GRAMMAR_LEVELS.map((value) => <li key={value}><button type="button" onClick={() => onChooseLevel(value)}><span className={`grammar-level-badge grammar-level-${value.toLocaleLowerCase()}`}>{value}</span><span><strong>{LEVEL_COPY[value].label}</strong><small className="tabular">{levelCounts[value]} topic{levelCounts[value] === 1 ? '' : 's'}</small></span><Icon name="chevron-right" size={14} /></button></li>)}</ul></section>
    <section className="grammar-rail-card glass" aria-labelledby="grammar-data-heading"><div className="grammar-rail-head"><div><p className="grammar-kicker">REAL CURRICULUM DATA</p><h2 id="grammar-data-heading">What is available</h2></div></div><dl className="grammar-data-list"><div><dt>Topics</dt><dd className="tabular">{items.length}</dd></div><div><dt>Examples</dt><dd className="tabular">{exampleCount}</dd></div><div><dt>Usage notes</dt><dd className="tabular">{usageCount}</dd></div><div><dt>Mistakes</dt><dd className="tabular">{mistakeCount}</dd></div></dl><p>No progress, mastery, or completion values are inferred from browsing.</p></section></aside>;
}
