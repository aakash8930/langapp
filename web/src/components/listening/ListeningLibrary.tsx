import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import { Icon } from '../ui/Icon';
import { useCorpus, type VocabItem } from '../library/useCorpus';
import {
  LISTENING_LEVELS,
  listeningLevelRank,
  sortListeningItems,
  type ListeningLevel,
} from './listeningData';
import { ListeningTabs } from './ListeningTabs';

import './listening.css';

type LevelFilter = 'all' | ListeningLevel;
type ContentFilter = 'all' | 'examples';
type SortMode = 'level' | 'word' | 'meaning';
const PAGE_SIZE = 20;
const LEVEL_COPY: Record<ListeningLevel, { label: string; note: string }> = {
  N5: { label: 'Beginner', note: 'Foundational words and phrases' },
  N4: { label: 'Elementary', note: 'Everyday listening vocabulary' },
  N3: { label: 'Intermediate', note: 'Broader spoken Japanese' },
  N2: { label: 'Advanced', note: 'Formal and detailed listening' },
  N1: { label: 'Expert', note: 'Nuanced high-level comprehension' },
};

function scrollToLessons() {
  window.requestAnimationFrame(() => document.getElementById('listening-lessons')?.scrollIntoView({ block: 'start', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
}

export function ListeningLibrary() {
  const corpus = useCorpus();
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<LevelFilter>('all');
  const [content, setContent] = useState<ContentFilter>('all');
  const [partOfSpeech, setPartOfSpeech] = useState('all');
  const [sort, setSort] = useState<SortMode>('level');
  const [page, setPage] = useState(0);
  const corpusItems = corpus.data?.items;
  const items = useMemo(() => sortListeningItems(corpusItems?.filter((item): item is VocabItem => item.kind === 'vocab') ?? []), [corpusItems]);
  const partsOfSpeech = useMemo(() => [...new Set(items.map((item) => item.pos).filter(Boolean))].sort(), [items]);
  const levelCounts = Object.fromEntries(LISTENING_LEVELS.map((value) => [value, items.filter((item) => item.jlpt === value).length])) as Record<ListeningLevel, number>;
  const exampleCount = items.reduce((total, item) => total + item.examples.length, 0);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    let result = items.filter((item) => {
      if (level !== 'all' && item.jlpt !== level) return false;
      if (content === 'examples' && item.examples.length === 0) return false;
      if (partOfSpeech !== 'all' && item.pos !== partOfSpeech) return false;
      if (!needle) return true;
      return `${item.lemma} ${item.reading} ${item.romaji ?? ''} ${item.gloss} ${item.pos} ${item.examples.map((example) => `${example.sentence} ${example.reading ?? ''} ${example.romaji ?? ''} ${example.gloss}`).join(' ')}`.toLocaleLowerCase().includes(needle);
    });
    if (sort === 'word') result = [...result].sort((left, right) => left.lemma.localeCompare(right.lemma, 'ja'));
    if (sort === 'meaning') result = [...result].sort((left, right) => left.gloss.localeCompare(right.gloss) || listeningLevelRank(left.jlpt) - listeningLevelRank(right.jlpt));
    return result;
  }, [content, items, level, partOfSpeech, query, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const shown = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  function chooseLevel(next: LevelFilter, reveal = false) {
    setLevel(next);
    setPage(0);
    if (reveal) scrollToLessons();
  }

  function clearFilters() {
    setQuery('');
    setLevel('all');
    setContent('all');
    setPartOfSpeech('all');
    setSort('level');
    setPage(0);
  }

  function changePage(next: number) {
    setPage(Math.max(0, Math.min(next, pageCount - 1)));
    scrollToLessons();
  }

  return <div className="page listening-reference"><section className="listening-hero glass"><div className="listening-hero-copy"><p className="listening-kicker">COURSE-BACKED PRONUNCIATION</p><h1><Icon name="headphones" size={44} /> Listening</h1><p>Train your ear with every vocabulary reading in the course. Open a lesson to use the audio player, reveal its transcript and translation, shadow the reading, and practise recall.</p><div className="listening-hero-actions"><button type="button" className="btn btn-primary" onClick={scrollToLessons}>Browse listening lessons <Icon name="chevron-down" size={16} /></button><Link className="btn btn-secondary" to="/listening-quiz">Start listening quiz</Link></div></div><div className="listening-hero-wave" aria-hidden="true"><Icon name="audio-lines" size={84} /><span className="ja" lang="ja">聞く</span><small>きく · kiku · to listen</small></div><dl className="listening-hero-metrics"><div><dt>Vocabulary lessons</dt><dd className="tabular">{corpus.isPending ? '—' : items.length}</dd></div><div><dt>Context examples</dt><dd className="tabular">{corpus.isPending ? '—' : exampleCount}</dd></div><div><dt>Beginner N5</dt><dd className="tabular">{corpus.isPending ? '—' : levelCounts.N5}</dd></div><div><dt>Parts of speech</dt><dd className="tabular">{corpus.isPending ? '—' : partsOfSpeech.length}</dd></div></dl></section><ListeningTabs active="lessons" />

    {corpus.isPending ? <div className="listening-loading glass" role="status"><Icon name="headphones" size={42} /><p>Loading listening lessons…</p></div> : corpus.isError ? <div className="note note-error listening-error" role="alert"><div><strong>The listening library could not be loaded.</strong><span>The content API may be asleep. Try again when it is available.</span></div><button type="button" className="btn btn-secondary btn-sm" onClick={() => void corpus.refetch()}>Try again</button></div> : items.length === 0 ? <div className="listening-empty glass"><span className="ja">空</span><h2>{corpus.data.failedUnits.length > 0 ? 'No listening lessons could be loaded' : 'No listening lessons are available'}</h2><p>{corpus.data.failedUnits.length > 0 ? `${corpus.data.failedUnits.length} course unit${corpus.data.failedUnits.length === 1 ? '' : 's'} failed to load. Try again when the content API is fully available.` : 'The server returned a curriculum without vocabulary content.'}</p>{corpus.data.failedUnits.length > 0 ? <button type="button" className="btn btn-secondary" onClick={() => void corpus.refetch()}>Try again</button> : null}</div> : <>{corpus.data.failedUnits.length > 0 ? <p className="note listening-partial"><strong>Some units are missing.</strong><span>{corpus.data.failedUnits.length} course unit{corpus.data.failedUnits.length === 1 ? '' : 's'} could not be loaded, so this list is incomplete.</span></p> : null}
      <section className="listening-level-path glass" aria-labelledby="listening-level-heading"><div className="listening-section-head"><div><p className="listening-kicker">BEGINNER TO ADVANCED</p><h2 id="listening-level-heading">Listening by JLPT level</h2></div><button type="button" className={level === 'all' ? 'is-active' : ''} onClick={() => chooseLevel('all')}>Show all levels</button></div><ol>{LISTENING_LEVELS.map((value, index) => <li key={value}><button type="button" className={level === value ? 'is-active' : ''} onClick={() => chooseLevel(value, true)} aria-pressed={level === value}><span className={`listening-level-badge listening-level-${value.toLocaleLowerCase()}`}>{value}</span><span><strong>{LEVEL_COPY[value].label}</strong><small>{LEVEL_COPY[value].note}</small></span><span className="tabular">{levelCounts[value]} lesson{levelCounts[value] === 1 ? '' : 's'}</span><i aria-hidden="true">{String(index + 1).padStart(2, '0')}</i></button></li>)}</ol>{LISTENING_LEVELS.some((value) => levelCounts[value] === 0) ? <p className="listening-level-note"><Icon name="check" size={13} /> Levels without course vocabulary remain visible and honestly empty.</p> : null}</section>
      <div className="listening-layout"><main className="listening-main"><section className="listening-library glass" id="listening-lessons" aria-labelledby="listening-lessons-heading"><div className="listening-section-head"><div><p className="listening-kicker">AUDIO LESSON INDEX</p><h2 id="listening-lessons-heading">Listening lessons</h2></div><span className="tabular" role="status">{filtered.length} matching lesson{filtered.length === 1 ? '' : 's'}</span></div><div className="listening-toolbar"><div className="listening-search" role="search"><Icon name="search" size={17} /><label className="visually-hidden" htmlFor="listening-search">Search listening lessons</label><input id="listening-search" type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Search word, reading, meaning, or example…" />{query ? <button type="button" onClick={() => { setQuery(''); setPage(0); }} aria-label="Clear listening search">×</button> : null}</div><label className="listening-sort"><span>Sort</span><select value={sort} onChange={(event) => { setSort(event.target.value as SortMode); setPage(0); }}><option value="level">N5 → N1</option><option value="word">Japanese word</option><option value="meaning">English meaning</option></select></label></div><div className="listening-filters"><label><span>JLPT</span><select value={level} onChange={(event) => chooseLevel(event.target.value as LevelFilter)}><option value="all">All levels</option>{LISTENING_LEVELS.map((value) => <option key={value} value={value}>{value} · {LEVEL_COPY[value].label} ({levelCounts[value]})</option>)}</select></label><label><span>Part of speech</span><select value={partOfSpeech} onChange={(event) => { setPartOfSpeech(event.target.value); setPage(0); }}><option value="all">All types</option>{partsOfSpeech.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label><span>Content</span><select value={content} onChange={(event) => { setContent(event.target.value as ContentFilter); setPage(0); }}><option value="all">All lessons</option><option value="examples">With context examples</option></select></label>{query || level !== 'all' || partOfSpeech !== 'all' || content !== 'all' || sort !== 'level' ? <button type="button" className="listening-clear" onClick={clearFilters}>Clear all</button> : null}</div>
        {filtered.length === 0 ? <div className="listening-empty listening-empty-inline"><span className="ja">探</span><h3>No matching listening lessons</h3><p>{level !== 'all' && levelCounts[level] === 0 ? `${level} listening vocabulary has not been added to the course yet.` : 'Try another word, meaning, level, or content filter.'}</p><button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>Clear search and filters</button></div> : <><ul className="listening-lesson-list">{shown.map((item, index) => <li key={item.id}><Link to="/listening/$id" params={{ id: item.id }}><span className="listening-lesson-index tabular">{String(safePage * PAGE_SIZE + index + 1).padStart(2, '0')}</span><span className="listening-lesson-play"><Icon name="play" size={17} /></span><span className="listening-lesson-word"><strong className="ja" lang="ja">{item.lemma}</strong><small>{item.reading !== item.lemma ? item.reading : item.romaji || 'Course reading'}</small></span><span className="listening-lesson-meaning"><strong>{item.gloss}</strong><small>{item.pos} · {item.examples.length} context example{item.examples.length === 1 ? '' : 's'}</small></span><span className={`listening-level-badge listening-level-${item.jlpt.toLocaleLowerCase()}`}>{item.jlpt}</span><span className="listening-lesson-open">Open player <Icon name="chevron-right" size={14} /></span></Link></li>)}</ul><div className="listening-pagination"><p className="tabular">Showing {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</p><div><button type="button" onClick={() => changePage(safePage - 1)} disabled={safePage === 0}><Icon name="chevron-left" size={15} /> Previous</button><span className="tabular">Page {safePage + 1} of {pageCount}</span><button type="button" onClick={() => changePage(safePage + 1)} disabled={safePage >= pageCount - 1}>Next <Icon name="chevron-right" size={15} /></button></div></div></>}
      </section></main><ListeningSidebar items={items} levelCounts={levelCounts} onChooseLevel={(next) => chooseLevel(next, true)} /></div></>}
  </div>;
}

function ListeningSidebar({ items, levelCounts, onChooseLevel }: { items: VocabItem[]; levelCounts: Record<ListeningLevel, number>; onChooseLevel: (level: ListeningLevel) => void }) {
  return <aside className="listening-rail" aria-label="Listening study tools"><section className="listening-rail-card glass"><div className="listening-rail-head"><div><p className="listening-kicker">QUICK PRACTICE</p><h2>Train your ear</h2></div><span><Icon name="headphones" size={19} /></span></div><ul className="listening-action-list"><li><Link to="/listening-shadowing"><span><Icon name="mic" size={17} /></span><span><strong>Pronunciation shadowing</strong><small>Listen, repeat, and compare</small></span><Icon name="chevron-right" size={14} /></Link></li><li><Link to="/listening-quiz"><span><Icon name="sparkles" size={17} /></span><span><strong>Listening quiz</strong><small>Audio to meaning or word</small></span><Icon name="chevron-right" size={14} /></Link></li><li><Link to="/hiragana-listening"><span><Icon name="languages" size={17} /></span><span><strong>Hiragana ear training</strong><small>Hear a sound and choose kana</small></span><Icon name="chevron-right" size={14} /></Link></li><li><Link to="/katakana-listening"><span><Icon name="languages" size={17} /></span><span><strong>Katakana ear training</strong><small>Practise loanword sounds</small></span><Icon name="chevron-right" size={14} /></Link></li></ul></section><section className="listening-rail-card glass"><div className="listening-rail-head"><div><p className="listening-kicker">COURSE COVERAGE</p><h2>Available by level</h2></div></div><ul className="listening-coverage-list">{LISTENING_LEVELS.map((value) => <li key={value}><button type="button" onClick={() => onChooseLevel(value)}><span className={`listening-level-badge listening-level-${value.toLocaleLowerCase()}`}>{value}</span><span><strong>{LEVEL_COPY[value].label}</strong><small className="tabular">{levelCounts[value]} lessons</small></span><Icon name="chevron-right" size={14} /></button></li>)}</ul></section><section className="listening-rail-card glass"><div className="listening-rail-head"><div><p className="listening-kicker">AUDIO FALLBACK</p><h2>Playback stays useful</h2></div></div><p className="listening-rail-copy">Each player tries the immutable course recording first. If that file is missing, it clearly switches to the browser&rsquo;s Japanese voice using the real curriculum reading.</p><dl className="listening-data-list"><div><dt>Lessons</dt><dd className="tabular">{items.length}</dd></div><div><dt>Speed range</dt><dd>0.5–2×</dd></div></dl></section></aside>;
}
