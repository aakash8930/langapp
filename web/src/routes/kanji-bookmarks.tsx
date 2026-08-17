import { createFileRoute, Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import { useCorpus, type KanjiItem } from '../components/library/useCorpus';
import { Icon } from '../components/ui/Icon';
import { useKanjiBookmarks } from '../hooks/useKanjiBookmarks';
import { kanjiRouteStyles } from '../styles/kanjiRouteStyles';

type BookmarkSort = 'newest' | 'oldest' | 'character';

export const Route = createFileRoute('/kanji-bookmarks')({
  component: KanjiBookmarkRoute,
});

function KanjiBookmarkRoute() {
  void kanjiRouteStyles;
  const { bookmarks, remove, clear } = useKanjiBookmarks();
  const corpus = useCorpus();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<BookmarkSort>('newest');
  const items = useMemo(() => corpus.data?.items.filter((item): item is KanjiItem => item.kind === 'kanji') ?? [], [corpus.data?.items]);
  const shown = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const result = bookmarks.filter((bookmark) => {
      const detail = items.find((item) => item.char === bookmark.char);
      return !needle || `${bookmark.char} ${bookmark.meaning} ${detail?.on.join(' ') ?? ''} ${detail?.kun.join(' ') ?? ''} ${detail?.radical ?? ''}`.toLocaleLowerCase().includes(needle);
    });
    if (sort === 'oldest') return [...result].sort((left, right) => left.addedAt - right.addedAt);
    if (sort === 'character') return [...result].sort((left, right) => left.char.localeCompare(right.char, 'ja'));
    return [...result].sort((left, right) => right.addedAt - left.addedAt);
  }, [bookmarks, items, query, sort]);

  function clearBookmarks() {
    if (window.confirm(`Remove all ${bookmarks.length} bookmarked kanji from this browser?`)) clear();
  }

  return (
    <div className="page kanji-reference kanji-bookmark-reference">
      <nav className="kanji-tabs glass" aria-label="Kanji sections"><Link to="/kanji"><Icon name="grid" size={16} /> Kanji list</Link><Link to="/kanji-writing"><Icon name="pen-tool" size={16} /> Writing</Link><Link to="/kanji-quiz"><Icon name="sparkles" size={16} /> Quiz</Link><Link to="/practice-hub"><Icon name="refresh-cw" size={16} /> Practice</Link><Link className="is-active" to="/kanji-bookmarks" aria-current="page"><Icon name="book-marked" size={16} /> Bookmarks <span className="tabular">{bookmarks.length}</span></Link></nav>

      <section className="kanji-bookmark-hero glass"><div><p className="kanji-kicker">SAVED ON THIS BROWSER</p><h1><span className="ja">栞</span> Bookmarked kanji</h1><p>Return to characters you want to study again. Bookmarks are local to this browser and do not claim mastery or review status.</p></div><div><strong className="tabular">{bookmarks.length}</strong><span>saved character{bookmarks.length === 1 ? '' : 's'}</span></div></section>

      {bookmarks.length === 0 ? <div className="kanji-empty glass"><span className="ja">星</span><h2>No bookmarked kanji</h2><p>Select the star on any kanji card or detail page to keep it here.</p><div className="kanji-problem-actions"><Link className="btn btn-primary" to="/kanji">Browse kanji</Link><Link className="btn btn-secondary" to="/kanji-writing">Open writing practice</Link></div></div> : <section className="kanji-bookmark-library glass" aria-labelledby="kanji-bookmarks-heading"><div className="kanji-section-head"><div><p className="kanji-kicker">YOUR SAVED CHARACTERS</p><h2 id="kanji-bookmarks-heading">Bookmarks</h2></div><button type="button" onClick={clearBookmarks}>Remove all</button></div><div className="kanji-toolbar"><div className="kanji-search" role="search"><Icon name="search" size={17} /><label className="visually-hidden" htmlFor="kanji-bookmark-search">Search bookmarked kanji</label><input id="kanji-bookmark-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search saved character, meaning, or reading…" />{query ? <button type="button" onClick={() => setQuery('')} aria-label="Clear bookmark search">×</button> : null}</div><label className="kanji-sort"><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value as BookmarkSort)}><option value="newest">Recently saved</option><option value="oldest">Oldest saved</option><option value="character">Character</option></select></label></div>{corpus.isError ? <p className="note"><strong>Details unavailable.</strong><span>Your local bookmarks are still shown, but readings and corpus facts could not be loaded.</span></p> : null}{shown.length === 0 ? <div className="kanji-empty kanji-empty-inline"><span className="ja">探</span><h3>No saved kanji match</h3><p>Try another character, meaning, or reading.</p><button type="button" className="btn btn-secondary btn-sm" onClick={() => setQuery('')}>Clear search</button></div> : <ul className="kanji-bookmark-grid">{shown.map((bookmark) => { const item = items.find((entry) => entry.char === bookmark.char); return <li key={bookmark.char}><article><div className="kanji-bookmark-card-main"><Link to="/kanji/$id" params={{ id: item?.id ?? bookmark.char }}><span className="ja">{bookmark.char}</span><div><strong>{bookmark.meaning}</strong>{item ? <><small className="ja">ON {item.on.join('、') || '—'} · KUN {item.kun.join('、') || '—'}</small><span>{item.radical} radical · {item.strokes} strokes · {item.jlpt}</span></> : <small>Open saved character</small>}</div><Icon name="chevron-right" size={15} /></Link><button type="button" onClick={() => remove(bookmark.char)} aria-label={`Remove ${bookmark.char} bookmark`}><Icon name="star" size={17} fill="currentColor" /></button></div><div className="kanji-bookmark-card-actions"><Link to="/kanji/$id" params={{ id: item?.id ?? bookmark.char }}>Details</Link><Link to="/kanji-writing">Writing practice</Link><Link to="/kanji-quiz">Quiz</Link></div></article></li>; })}</ul>}</section>}
    </div>
  );
}
