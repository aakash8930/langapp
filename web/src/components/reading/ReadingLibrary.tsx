import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import { fetchReadableSentences, fetchReadableVocab } from '../../api';
import { queryKeys } from '../../queryKeys';
import { useSession } from '../../useSession';
import { useCorpus, type GrammarItem, type VocabItem } from '../library/useCorpus';
import { Icon } from '../ui/Icon';
import { buildReadingEntries, readingKindLabel, type ReadingKind } from './readingData';
import { ReadingTabs } from './ReadingTabs';
import { useReadingBookmarks } from './useReadingBookmarks';

import './reading.css';

type Scope = 'all' | 'readable' | 'saved';
type Level = 'all' | 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
type Kind = 'all' | ReadingKind;
type Length = 'all' | 'short' | 'medium' | 'long';
type Sort = 'course' | 'shortest' | 'longest' | 'japanese' | 'translation';
const PAGE_SIZE = 24;

function lengthMatches(characters: number, filter: Length): boolean {
  if (filter === 'short') return characters <= 12;
  if (filter === 'medium') return characters >= 13 && characters <= 30;
  if (filter === 'long') return characters > 30;
  return true;
}

export function ReadingLibrary() {
  const corpus = useCorpus();
  const { session } = useSession();
  const signedIn = session.state === 'signedIn';
  const readableWords = useQuery({ queryKey: queryKeys.reading.readableVocab, queryFn: () => fetchReadableVocab(200), enabled: signedIn, staleTime: 5 * 60_000 });
  const readableSentences = useQuery({ queryKey: queryKeys.reading.readableSentences, queryFn: () => fetchReadableSentences(200), enabled: signedIn, staleTime: 5 * 60_000 });
  const { bookmarks, isBookmarked, toggle } = useReadingBookmarks();
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const [level, setLevel] = useState<Level>('all');
  const [kind, setKind] = useState<Kind>('all');
  const [length, setLength] = useState<Length>('all');
  const [sort, setSort] = useState<Sort>('course');
  const [page, setPage] = useState(0);
  const corpusItems = corpus.data?.items;
  const vocab = useMemo(() => corpusItems?.filter((item): item is VocabItem => item.kind === 'vocab') ?? [], [corpusItems]);
  const grammar = useMemo(() => corpusItems?.filter((item): item is GrammarItem => item.kind === 'grammar') ?? [], [corpusItems]);
  const entries = useMemo(() => buildReadingEntries(vocab, grammar), [grammar, vocab]);
  const savedIds = useMemo(() => new Set(bookmarks.map((bookmark) => bookmark.id)), [bookmarks]);
  const readableIds = useMemo(() => new Set([
    ...(readableWords.data ?? []).map((item) => `word-${item.id}`),
    ...(readableSentences.data ?? []).map((item) => `grammar-${item.grammarPointId}-${item.exampleIndex}`),
  ]), [readableSentences.data, readableWords.data]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    let result = entries.filter((entry) => {
      if (scope === 'saved' && !savedIds.has(entry.id)) return false;
      if (scope === 'readable' && !readableIds.has(entry.id)) return false;
      if (level !== 'all' && entry.jlpt !== level) return false;
      if (kind !== 'all' && entry.kind !== kind) return false;
      if (!lengthMatches(entry.characters, length)) return false;
      return !needle || `${entry.sentence} ${entry.reading ?? ''} ${entry.romaji ?? ''} ${entry.translation} ${entry.sourceTitle} ${entry.label}`.toLocaleLowerCase().includes(needle);
    });
    if (sort === 'shortest') result = [...result].sort((left, right) => left.characters - right.characters);
    if (sort === 'longest') result = [...result].sort((left, right) => right.characters - left.characters);
    if (sort === 'japanese') result = [...result].sort((left, right) => left.sentence.localeCompare(right.sentence, 'ja'));
    if (sort === 'translation') result = [...result].sort((left, right) => left.translation.localeCompare(right.translation));
    return result;
  }, [entries, kind, length, level, query, readableIds, savedIds, scope, sort]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const shown = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const contextCount = entries.filter((entry) => entry.kind === 'context').length;
  const grammarCount = entries.filter((entry) => entry.kind === 'grammar').length;

  function updateFilter(update: () => void) {
    update();
    setPage(0);
  }

  function clearFilters() {
    setQuery('');
    setScope('all');
    setLevel('all');
    setKind('all');
    setLength('all');
    setSort('course');
    setPage(0);
  }

  return <div className="page reading-reference"><ReadingTabs active="library" /><section className="reading-library-hero glass"><div><p className="reading-kicker">REAL COURSE MATERIAL</p><h1><Icon name="library" size={40} /> Reading library</h1><p>Browse vocabulary readings, stored context sentences, and authored grammar examples. Filters describe facts the corpus actually contains—never invented topics, durations, or difficulty scores.</p></div><dl><div><dt>All entries</dt><dd className="tabular">{corpus.isPending || corpus.isError ? '—' : entries.length}</dd></div><div><dt>Context sentences</dt><dd className="tabular">{corpus.isPending || corpus.isError ? '—' : contextCount}</dd></div><div><dt>Grammar examples</dt><dd className="tabular">{corpus.isPending || corpus.isError ? '—' : grammarCount}</dd></div><div><dt>Saved</dt><dd className="tabular">{bookmarks.length}</dd></div></dl></section>
    {corpus.isPending ? <div className="reading-loading glass" role="status"><Icon name="book-open" size={40} /><p>Loading reading material…</p></div> : corpus.isError ? <div className="note note-error reading-error" role="alert"><div><strong>The reading library could not be loaded.</strong><span>The content API may be asleep. Your local bookmarks remain safe.</span></div><button type="button" className="btn btn-secondary btn-sm" onClick={() => void corpus.refetch()}>Try again</button></div> : entries.length === 0 ? <section className="reading-empty glass"><span className="ja" lang="ja">空</span><h2>No reading material is available</h2><p>{corpus.data.failedUnits.length > 0 ? 'Course units failed to load. Try again when the content API is available.' : 'The loaded curriculum has no vocabulary or grammar examples.'}</p></section> : <>{corpus.data.failedUnits.length > 0 ? <p className="note reading-partial"><strong>Partial course data.</strong><span>{corpus.data.failedUnits.length} course unit{corpus.data.failedUnits.length === 1 ? '' : 's'} could not be loaded.</span></p> : null}<div className="reading-library-layout"><main className="reading-library-panel glass" aria-labelledby="reading-results-heading"><div className="reading-section-head"><div><p className="reading-kicker">INTERACTIVE ENTRIES</p><h2 id="reading-results-heading">Reading material</h2></div><span className="tabular" role="status">{filtered.length} matching</span></div><div className="reading-toolbar"><div className="reading-search" role="search"><Icon name="search" size={17} /><label className="visually-hidden" htmlFor="reading-search">Search reading material</label><input id="reading-search" type="search" value={query} onChange={(event) => updateFilter(() => setQuery(event.target.value))} placeholder="Search Japanese, reading, translation, or source…" />{query ? <button type="button" onClick={() => updateFilter(() => setQuery(''))} aria-label="Clear reading search">×</button> : null}</div><label className="reading-select"><span>Sort</span><select value={sort} onChange={(event) => updateFilter(() => setSort(event.target.value as Sort))}><option value="course">Course order</option><option value="shortest">Shortest first</option><option value="longest">Longest first</option><option value="japanese">Japanese text</option><option value="translation">English translation</option></select></label></div><div className="reading-filters"><label><span>Scope</span><select value={scope} onChange={(event) => updateFilter(() => setScope(event.target.value as Scope))}><option value="all">All course material</option><option value="readable" disabled={!signedIn}>Readable with my known kana</option><option value="saved">Saved passages ({bookmarks.length})</option></select></label><label><span>JLPT</span><select value={level} onChange={(event) => updateFilter(() => setLevel(event.target.value as Level))}><option value="all">All levels</option>{(['N5', 'N4', 'N3', 'N2', 'N1'] as const).map((value) => <option key={value} value={value}>{value} · {entries.filter((entry) => entry.jlpt === value).length}</option>)}</select></label><label><span>Content</span><select value={kind} onChange={(event) => updateFilter(() => setKind(event.target.value as Kind))}><option value="all">Words and sentences</option><option value="word">Course words</option><option value="context">Context sentences</option><option value="grammar">Grammar examples</option></select></label><label><span>Length</span><select value={length} onChange={(event) => updateFilter(() => setLength(event.target.value as Length))}><option value="all">Any character count</option><option value="short">Short · up to 12</option><option value="medium">Medium · 13–30</option><option value="long">Long · 31+</option></select></label>{query || scope !== 'all' || level !== 'all' || kind !== 'all' || length !== 'all' || sort !== 'course' ? <button type="button" className="reading-clear" onClick={clearFilters}>Clear all</button> : null}</div>{scope === 'readable' && (readableWords.isPending || readableSentences.isPending) ? <p className="reading-filter-note" role="status">Checking material against your known kana…</p> : scope === 'readable' && (readableWords.isError || readableSentences.isError) ? <p className="note"><strong>Personalised readability is unavailable.</strong><span>The account API may be asleep. Other library filters still work.</span></p> : !signedIn ? <p className="reading-filter-note"><Icon name="lock" size={13} /> Sign in to filter by the kana your account knows. The public course library remains available.</p> : null}{filtered.length === 0 ? <div className="reading-empty reading-empty-inline"><span className="ja" lang="ja">探</span><h3>No matching reading material</h3><p>{scope === 'saved' && bookmarks.length === 0 ? 'Save a passage first, or return to all course material.' : 'Try another Japanese phrase, level, content type, or length.'}</p><button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>Clear search and filters</button></div> : <><ul className="reading-entry-grid">{shown.map((entry) => <li key={entry.id}><article><div className="reading-entry-top"><span className="reading-type-badge">{readingKindLabel(entry.kind)}</span><button type="button" className={isBookmarked(entry.id) ? 'is-saved' : ''} onClick={() => toggle(entry)} aria-label={isBookmarked(entry.id) ? 'Remove reading bookmark' : 'Save reading passage'}><Icon name="book-marked" size={16} fill={isBookmarked(entry.id) ? 'currentColor' : 'none'} /></button></div><Link to="/reading/$id" params={{ id: entry.id }}><p className="ja" lang="ja">{entry.sentence}</p>{entry.reading && entry.reading !== entry.sentence ? <small className="ja" lang="ja">{entry.reading}</small> : entry.romaji ? <small>{entry.romaji}</small> : null}<strong>{entry.translation}</strong><div><span>{entry.jlpt}</span><span className="tabular">{entry.characters} characters</span><span>{entry.label}</span></div><span className="reading-entry-open">Open interactive reader <Icon name="chevron-right" size={14} /></span></Link></article></li>)}</ul><div className="reading-pagination"><p className="tabular">Showing {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</p><div><button type="button" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={safePage === 0}><Icon name="chevron-left" size={14} /> Previous</button><span className="tabular">{safePage + 1} / {pageCount}</span><button type="button" onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} disabled={safePage >= pageCount - 1}>Next <Icon name="chevron-right" size={14} /></button></div></div></>}</main><aside className="reading-library-rail"><section className="reading-rail-card glass"><p className="reading-kicker">CONTENT FACTS</p><h2>What this library contains</h2><dl><div><dt>Vocabulary readings</dt><dd className="tabular">{vocab.length}</dd></div><div><dt>Stored examples</dt><dd className="tabular">{contextCount}</dd></div><div><dt>Grammar examples</dt><dd className="tabular">{grammarCount}</dd></div><div><dt>Authored formats</dt><dd>Course corpus</dd></div></dl></section><section className="reading-rail-card glass"><p className="reading-kicker">FILTER LIMITS</p><h2>No invented metadata</h2><p>The API does not currently provide article topics, author-assigned difficulty, estimated reading time, vocabulary bands, or grammar bands beyond JLPT. This library filters by real source, level, and character count instead.</p></section><section className="reading-rail-card glass"><p className="reading-kicker">OTHER FORMATS</p><h2>Article · Story · Manga · News</h2><p>There are no authored records for these formats in the current content model.</p><Link to="/reading-formats">See format requirements <Icon name="chevron-right" size={14} /></Link></section></aside></div></>}
  </div>;
}
