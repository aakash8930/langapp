import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import { Icon } from '../ui/Icon';
import { useCorpus, type GrammarItem, type VocabItem } from '../library/useCorpus';
import { buildReadingEntries, readingKindLabel } from './readingData';
import { ReadingTabs } from './ReadingTabs';
import { useReadingBookmarks } from './useReadingBookmarks';

import './reading.css';

export function ReadingBookmarks() {
  const corpus = useCorpus();
  const { bookmarks, remove, clear } = useReadingBookmarks();
  const [query, setQuery] = useState('');
  const corpusItems = corpus.data?.items;
  const vocab = useMemo(() => corpusItems?.filter((item): item is VocabItem => item.kind === 'vocab') ?? [], [corpusItems]);
  const grammar = useMemo(() => corpusItems?.filter((item): item is GrammarItem => item.kind === 'grammar') ?? [], [corpusItems]);
  const entries = useMemo(() => buildReadingEntries(vocab, grammar), [grammar, vocab]);
  const entryIds = useMemo(() => new Set(entries.map((entry) => entry.id)), [entries]);
  const filtered = bookmarks.filter((bookmark) => `${bookmark.sentence} ${bookmark.translation} ${bookmark.sourceTitle}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  return <div className="page reading-reference"><ReadingTabs active="bookmarks" /><header className="reading-page-header"><div><p className="reading-kicker">SAVED READING</p><h1>Reading Bookmarks</h1><p>Passages you saved in this browser, kept separate from saved vocabulary words.</p></div><span className="reading-header-count"><strong className="tabular">{bookmarks.length}</strong> saved</span></header>{bookmarks.length > 0 ? <section className="reading-bookmark-toolbar glass"><label className="reading-search"><Icon name="search" size={16} /><span className="sr-only">Search saved passages</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search saved Japanese or translation" /></label><button type="button" onClick={clear}><Icon name="trash" size={15} /> Clear all</button></section> : null}{corpus.isError && bookmarks.length > 0 ? <div className="reading-inline-notice is-warning" role="status"><Icon name="wifi-off" size={16} /><p>Live corpus content could not be loaded. Saved snapshots remain visible, but opening a full interactive reader requires the source corpus.</p></div> : null}{bookmarks.length === 0 ? <section className="reading-empty glass"><Icon name="book-marked" size={42} /><h2>No saved passages yet</h2><p>Save a sentence from the library or interactive reader and it will appear here. Vocabulary bookmarks continue to live in their existing collection.</p><Link className="btn btn-primary" to="/reading-library">Explore the library</Link></section> : filtered.length === 0 ? <section className="reading-empty glass"><Icon name="search" size={38} /><h2>No saved passage matches</h2><p>Try another Japanese word or English meaning.</p><button type="button" className="btn btn-secondary" onClick={() => setQuery('')}>Clear search</button></section> : <section className="reading-bookmark-grid" aria-label="Saved reading passages">{filtered.map((bookmark) => { const isAvailable = !corpus.isError && (!corpus.isPending && entryIds.has(bookmark.id)); return <article className="reading-bookmark-card glass" key={bookmark.id}><div className="reading-card-topline"><span className="reading-type-badge">{readingKindLabel(bookmark.kind)}</span><button type="button" onClick={() => remove(bookmark.id)} aria-label={`Remove ${bookmark.sentence} from reading bookmarks`}><Icon name="trash" size={15} /></button></div><h2 className="ja" lang="ja">{bookmark.sentence}</h2><p>{bookmark.translation}</p><div className="reading-bookmark-meta"><span>{bookmark.jlpt}</span><span>Saved {new Date(bookmark.addedAt).toLocaleDateString()}</span></div>{isAvailable ? <Link className="btn btn-secondary btn-sm" to="/reading/$id" params={{ id: bookmark.id }}>Open reader <Icon name="arrow-right" size={14} /></Link> : <span className="reading-unavailable"><Icon name="info" size={14} /> {corpus.isPending ? 'Checking source…' : 'Source unavailable'}</span>}</article>; })}</section>}<section className="reading-system-note glass"><Icon name="info" size={18} /><div><h2>Two honest bookmark systems</h2><p>Reading Bookmarks save passage snapshots. The established Vocabulary Bookmarks collection saves course words selected from dictionary popups.</p></div><Link className="btn btn-secondary btn-sm" to="/vocab-bookmarks">Open saved vocabulary</Link></section></div>;
}
