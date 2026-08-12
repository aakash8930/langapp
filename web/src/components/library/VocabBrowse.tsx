import { Link } from '@tanstack/react-router';
import { useMemo, useState, type FormEvent } from 'react';

import type { VocabItem } from './useCorpus';
import { useCorpus } from './useCorpus';
import { useSession } from '../../useSession';
import { Icon } from '../ui/Icon';
import { SpeakButton } from '../SpeakButton';

import './vocab-browse.css';

type ListSummary = {
  id: string;
  name: string;
  entries: { id: string }[];
};

type BookmarkSummary = {
  id: string;
  lemma: string;
  reading: string;
  gloss: string;
  addedAt: number;
};

type VocabEntry = {
  id: string;
  lemma: string;
  reading: string;
  gloss: string;
  pos: string;
  jlpt: string;
};

type SortMode = 'course' | 'japanese' | 'meaning' | 'reading' | 'jlpt';
type ViewMode = 'table' | 'cards';
type Scope = 'all' | 'saved' | `list:${string}`;

const PAGE_SIZE = 30;

function readablePos(pos: string): string {
  return pos.replaceAll('-', ' ').replaceAll('_', ' ');
}

function jlptRank(value: string): number {
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : 99;
}

function scrollToLibrary() {
  window.requestAnimationFrame(() => {
    document.getElementById('vocab-library')?.scrollIntoView({
      block: 'start',
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  });
}

export function VocabBrowse({
  bookmarked,
  bookmarks,
  onToggleBookmark,
  lists,
  onCreateList,
  onAddToList,
}: {
  bookmarked: Set<string>;
  bookmarks: BookmarkSummary[];
  onToggleBookmark: (id: string, lemma: string, reading: string, gloss: string) => void;
  lists: ListSummary[];
  onCreateList: (name: string) => void;
  onAddToList: (listId: string, entry: VocabEntry) => void;
}) {
  const corpus = useCorpus();
  const { session } = useSession();
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const [jlpt, setJlpt] = useState('all');
  const [pos, setPos] = useState('all');
  const [examplesOnly, setExamplesOnly] = useState(false);
  const [sort, setSort] = useState<SortMode>('course');
  const [view, setView] = useState<ViewMode>('table');
  const [page, setPage] = useState(0);

  const corpusItems = corpus.data?.items;
  const items = useMemo(
    () => corpusItems?.filter((item): item is VocabItem => item.kind === 'vocab') ?? [],
    [corpusItems],
  );
  const jlptOptions = useMemo(
    () => [...new Set(items.map((item) => item.jlpt).filter(Boolean))]
      .sort((left, right) => jlptRank(left) - jlptRank(right)),
    [items],
  );
  const posOptions = useMemo(
    () => [...new Set(items.map((item) => item.pos).filter(Boolean))]
      .sort((left, right) => readablePos(left).localeCompare(readablePos(right))),
    [items],
  );

  const filtered = useMemo(() => {
    let result = items;
    if (scope === 'saved') {
      result = result.filter((item) => bookmarked.has(item.id));
    } else if (scope.startsWith('list:')) {
      const listId = scope.slice('list:'.length);
      const list = lists.find((candidate) => candidate.id === listId);
      const ids = new Set(list?.entries.map((entry) => entry.id) ?? []);
      result = result.filter((item) => ids.has(item.id));
    }
    if (jlpt !== 'all') result = result.filter((item) => item.jlpt === jlpt);
    if (pos !== 'all') result = result.filter((item) => item.pos === pos);
    if (examplesOnly) result = result.filter((item) => item.examples.length > 0);

    const needle = query.trim().toLocaleLowerCase();
    if (needle) {
      result = result.filter((item) =>
        `${item.lemma} ${item.reading} ${item.romaji ?? ''} ${item.gloss} ${item.pos} ${item.synonyms.join(' ')} ${item.antonyms.join(' ')}`
          .toLocaleLowerCase()
          .includes(needle),
      );
    }

    if (sort === 'course') return result;
    return [...result].sort((left, right) => {
      if (sort === 'japanese') return left.lemma.localeCompare(right.lemma, 'ja');
      if (sort === 'meaning') return left.gloss.localeCompare(right.gloss);
      if (sort === 'reading') return left.reading.localeCompare(right.reading, 'ja');
      return jlptRank(left.jlpt) - jlptRank(right.jlpt) || left.lemma.localeCompare(right.lemma, 'ja');
    });
  }, [bookmarked, examplesOnly, items, jlpt, lists, pos, query, scope, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const shown = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const exampleCount = items.filter((item) => item.examples.length > 0).length;
  const activeFilterCount = Number(scope !== 'all') + Number(jlpt !== 'all') + Number(pos !== 'all') + Number(examplesOnly);
  const audioSpeed = session.state === 'signedIn' ? session.user.settings.audioSpeed : 1;

  function updateScope(next: Scope, reveal = false) {
    setScope(next);
    setPage(0);
    if (reveal) scrollToLibrary();
  }

  function clearFilters() {
    setQuery('');
    setScope('all');
    setJlpt('all');
    setPos('all');
    setExamplesOnly(false);
    setSort('course');
    setPage(0);
  }

  function goToPage(nextPage: number) {
    setPage(Math.max(0, Math.min(nextPage, pageCount - 1)));
    scrollToLibrary();
  }

  return (
    <div className="page vocab-reference">
      <section className="vocab-hero glass">
        <div className="vocab-hero-copy">
          <p className="vocab-kicker">COURSE WORD LIBRARY</p>
          <h1><span className="ja" aria-hidden="true">語</span> Vocabulary</h1>
          <p>Find every word taught by the Japanese course, hear its reading, study real examples, and build practice collections that stay on this browser.</p>
          <div className="vocab-hero-actions">
            <button type="button" className="btn btn-primary" onClick={scrollToLibrary}>
              Browse words <Icon name="chevron-down" size={16} />
            </button>
            <Link className="btn btn-secondary" to="/vocab-practice">Start a 10-word quiz</Link>
          </div>
        </div>

        <div className="vocab-hero-word" aria-hidden="true">
          <span className="ja">言葉</span>
          <small>ことば · kotoba · words</small>
        </div>

        <dl className="vocab-hero-metrics">
          <div><dt>Course words</dt><dd className="tabular">{corpus.isPending ? '—' : items.length}</dd></div>
          <div><dt>Saved</dt><dd className="tabular">{bookmarked.size}</dd></div>
          <div><dt>Collections</dt><dd className="tabular">{lists.length}</dd></div>
          <div><dt>With examples</dt><dd className="tabular">{corpus.isPending ? '—' : exampleCount}</dd></div>
        </dl>
      </section>

      <nav className="vocab-tabs glass" aria-label="Vocabulary sections">
        <Link className="is-active" to="/vocabulary" aria-current="page"><Icon name="book-open" size={16} /> Library</Link>
        <Link to="/vocab-bookmarks"><Icon name="book-marked" size={16} /> Saved <span className="tabular">{bookmarked.size}</span></Link>
        <Link to="/vocab-lists"><Icon name="layers" size={16} /> Collections <span className="tabular">{lists.length}</span></Link>
        <Link to="/vocab-practice"><Icon name="sparkles" size={16} /> Practice</Link>
      </nav>

      {corpus.isPending ? (
        <div className="vocab-loading glass" role="status"><span className="ja">語</span><p>Loading the course vocabulary…</p></div>
      ) : corpus.isError ? (
        <div className="note note-error vocab-error" role="alert">
          <div><strong>The vocabulary library could not be loaded.</strong><span>The API may be asleep. Your saved words and collections are still safe on this browser.</span></div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void corpus.refetch()}>Try again</button>
        </div>
      ) : items.length === 0 ? (
        <div className="vocab-empty glass"><span className="ja">空</span><h2>No course words are available</h2><p>The server returned a syllabus without vocabulary content.</p></div>
      ) : (
        <>
          {corpus.data.failedUnits.length > 0 ? (
            <p className="note vocab-partial"><strong>Some units are missing.</strong><span>{corpus.data.failedUnits.length} course unit{corpus.data.failedUnits.length === 1 ? '' : 's'} could not be loaded, so the results below are incomplete.</span></p>
          ) : null}

          <div className="vocab-layout">
            <main className="vocab-main">
              <section className="vocab-library glass" id="vocab-library" aria-labelledby="vocab-library-heading">
                <div className="vocab-section-head">
                  <div><p className="vocab-kicker">SEARCH, FILTER & STUDY</p><h2 id="vocab-library-heading">Vocabulary list</h2></div>
                  <span className="tabular" role="status">{filtered.length} matching word{filtered.length === 1 ? '' : 's'}</span>
                </div>

                <div className="vocab-toolbar">
                  <div className="vocab-search" role="search">
                    <Icon name="search" size={17} />
                    <label className="visually-hidden" htmlFor="vocab-search-input">Search vocabulary by Japanese, reading, romaji, meaning, or related word</label>
                    <input
                      id="vocab-search-input"
                      type="search"
                      placeholder="Search Japanese, romaji, or meaning…"
                      value={query}
                      onChange={(event) => { setQuery(event.target.value); setPage(0); }}
                    />
                    {query ? <button type="button" onClick={() => { setQuery(''); setPage(0); }} aria-label="Clear vocabulary search">×</button> : null}
                  </div>

                  <label className="vocab-select-wrap">
                    <span>Sort</span>
                    <select value={sort} onChange={(event) => { setSort(event.target.value as SortMode); setPage(0); }}>
                      <option value="course">Course order</option>
                      <option value="japanese">Japanese A–Z</option>
                      <option value="reading">Reading A–Z</option>
                      <option value="meaning">Meaning A–Z</option>
                      <option value="jlpt">JLPT level</option>
                    </select>
                  </label>

                  <div className="vocab-view-toggle" role="group" aria-label="Vocabulary view">
                    <button type="button" className={view === 'table' ? 'is-active' : ''} onClick={() => setView('table')} aria-pressed={view === 'table'} aria-label="Table view"><Icon name="menu" size={16} /></button>
                    <button type="button" className={view === 'cards' ? 'is-active' : ''} onClick={() => setView('cards')} aria-pressed={view === 'cards'} aria-label="Card view"><Icon name="grid" size={16} /></button>
                  </div>
                </div>

                <div className="vocab-filters" aria-label="Vocabulary filters">
                  <label><span>Show</span><select value={scope} onChange={(event) => updateScope(event.target.value as Scope)}>
                    <option value="all">All words</option>
                    <option value="saved">Saved words ({bookmarked.size})</option>
                    {lists.map((list) => <option key={list.id} value={`list:${list.id}`}>{list.name} ({list.entries.length})</option>)}
                  </select></label>
                  <label><span>JLPT</span><select value={jlpt} onChange={(event) => { setJlpt(event.target.value); setPage(0); }}>
                    <option value="all">All levels</option>
                    {jlptOptions.map((level) => <option value={level} key={level}>{level}</option>)}
                  </select></label>
                  <label><span>Word type</span><select value={pos} onChange={(event) => { setPos(event.target.value); setPage(0); }}>
                    <option value="all">All types</option>
                    {posOptions.map((value) => <option value={value} key={value}>{readablePos(value)}</option>)}
                  </select></label>
                  <label className="vocab-check"><input type="checkbox" checked={examplesOnly} onChange={(event) => { setExamplesOnly(event.target.checked); setPage(0); }} /><span>Has examples</span></label>
                  {activeFilterCount > 0 || query || sort !== 'course' ? <button type="button" className="vocab-clear" onClick={clearFilters}>Clear all</button> : null}
                </div>

                {filtered.length === 0 ? (
                  <div className="vocab-empty vocab-empty-inline">
                    <span className="ja">探</span><h3>No matching words</h3><p>Try another spelling or remove one of the active filters.</p><button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>Clear search and filters</button>
                  </div>
                ) : (
                  <>
                    {view === 'table' ? (
                      <div className="vocab-table-head" aria-hidden="true"><span>Word</span><span>Meaning</span><span>Reading</span><span>Type / level</span><span>Save</span></div>
                    ) : null}
                    <ul className={`vocab-list vocab-list-${view}`}>
                      {shown.map((item) => (
                        <VocabRow
                          key={item.id}
                          item={item}
                          isBookmarked={bookmarked.has(item.id)}
                          onToggleBookmark={onToggleBookmark}
                          lists={lists}
                          onAddToList={onAddToList}
                          audioSpeed={audioSpeed}
                        />
                      ))}
                    </ul>

                    <div className="vocab-pagination">
                      <p className="tabular">Showing {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</p>
                      <div>
                        <button type="button" onClick={() => goToPage(safePage - 1)} disabled={safePage === 0}><Icon name="chevron-left" size={15} /> Previous</button>
                        <span className="tabular">Page {safePage + 1} of {pageCount}</span>
                        <button type="button" onClick={() => goToPage(safePage + 1)} disabled={safePage >= pageCount - 1}>Next <Icon name="chevron-right" size={15} /></button>
                      </div>
                    </div>
                  </>
                )}
              </section>
            </main>

            <VocabSidebar
              bookmarks={bookmarks}
              lists={lists}
              onCreateList={onCreateList}
              onChooseScope={(next) => updateScope(next, true)}
              onFindSaved={(bookmark) => {
                setScope('saved');
                setQuery(bookmark.lemma);
                setPage(0);
                scrollToLibrary();
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

function VocabRow({
  item,
  isBookmarked,
  onToggleBookmark,
  lists,
  onAddToList,
  audioSpeed,
}: {
  item: VocabItem;
  isBookmarked: boolean;
  onToggleBookmark: (id: string, lemma: string, reading: string, gloss: string) => void;
  lists: ListSummary[];
  onAddToList: (listId: string, entry: VocabEntry) => void;
  audioSpeed: number;
}) {
  const [selectedList, setSelectedList] = useState('');
  const [addedMessage, setAddedMessage] = useState('');
  const selected = lists.find((list) => list.id === selectedList);
  const alreadyAdded = selected?.entries.some((entry) => entry.id === item.id) ?? false;

  function addToSelectedList() {
    if (!selectedList || alreadyAdded) return;
    onAddToList(selectedList, {
      id: item.id,
      lemma: item.lemma,
      reading: item.reading,
      gloss: item.gloss,
      pos: item.pos,
      jlpt: item.jlpt,
    });
    setAddedMessage(`Added to ${selected?.name ?? 'collection'}`);
  }

  return (
    <li>
      <details className="vocab-detail-card">
        <summary className="vocab-detail-summary">
          <span className="vocab-word-cell"><strong className="vocab-lemma ja" lang="ja">{item.lemma}</strong>{item.reading === item.lemma ? null : <small className="ja" lang="ja">{item.reading}</small>}</span>
          <span className="vocab-gloss">{item.gloss}</span>
          <span className="vocab-reading-cell">{item.romaji ?? (item.reading === item.lemma ? item.reading : '')}</span>
          <span className="vocab-meta"><span className="vocab-tag">{readablePos(item.pos)}</span><span className="vocab-tag vocab-tag-jlpt">{item.jlpt}</span></span>
          <span className="vocab-bookmark-slot" aria-hidden="true" />
          <Icon className="vocab-disclosure" name="chevron-down" size={15} />
        </summary>
        <button
          type="button"
          className={`vocab-bookmark-btn vocab-summary-bookmark${isBookmarked ? ' vocab-bookmarked' : ''}`}
          onClick={() => onToggleBookmark(item.id, item.lemma, item.reading, item.gloss)}
          aria-label={isBookmarked ? `Remove ${item.lemma} from saved words` : `Save ${item.lemma}`}
          title={isBookmarked ? 'Remove saved word' : 'Save word'}
        ><Icon name="star" size={17} fill={isBookmarked ? 'currentColor' : 'none'} /></button>

        <div className="vocab-detail-body">
          <div className="vocab-detail-lead">
            <div><p className="vocab-detail-label">WORD DETAILS</p><h3 className="ja" lang="ja">{item.lemma}</h3><p>{item.reading}{item.romaji ? ` · ${item.romaji}` : ''}</p></div>
            <SpeakButton vocabId={item.id} label="Hear this word" speed={audioSpeed} />
          </div>

          <dl className="vocab-detail-facts">
            <div><dt>Meaning</dt><dd>{item.gloss}</dd></div>
            <div><dt>Word type</dt><dd>{readablePos(item.pos)}</dd></div>
            <div><dt>JLPT level</dt><dd><span className="vocab-tag vocab-tag-jlpt">{item.jlpt}</span></dd></div>
            <div><dt>Examples</dt><dd className="tabular">{item.examples.length}</dd></div>
          </dl>

          {item.examples.length > 0 ? (
            <section className="vocab-examples" aria-labelledby={`examples-${item.id}`}>
              <h4 className="vocab-section-title" id={`examples-${item.id}`}>Examples from the course</h4>
              <ul className="example-list">
                {item.examples.map((example, index) => (
                  <li className="example" key={`${item.id}-example-${index}`}>
                    <p className="example-sentence ja" lang="ja">{example.sentence}</p>
                    {example.reading && example.reading !== example.sentence ? <p className="example-reading ja" lang="ja">{example.reading}</p> : null}
                    {example.romaji ? <p className="example-romaji">{example.romaji}</p> : null}
                    <p className="example-gloss">{example.gloss}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <p className="vocab-detail-note">No example sentence is included for this course word yet.</p>
          )}

          {item.synonyms.length > 0 || item.antonyms.length > 0 ? (
            <div className="vocab-related-grid">
              {item.synonyms.length > 0 ? <section><h4 className="vocab-section-title">Synonyms</h4><div className="vocab-related-tags">{item.synonyms.map((word) => <span key={word} className="vocab-tag vocab-tag-related">{word}</span>)}</div></section> : null}
              {item.antonyms.length > 0 ? <section><h4 className="vocab-section-title">Antonyms</h4><div className="vocab-related-tags">{item.antonyms.map((word) => <span key={word} className="vocab-tag vocab-tag-related">{word}</span>)}</div></section> : null}
            </div>
          ) : null}

          <div className="vocab-row-actions">
            <button type="button" className={`btn btn-sm ${isBookmarked ? 'btn-primary' : 'btn-secondary'}`} onClick={() => onToggleBookmark(item.id, item.lemma, item.reading, item.gloss)}>
              <Icon name="star" size={15} fill={isBookmarked ? 'currentColor' : 'none'} /> {isBookmarked ? 'Saved' : 'Save word'}
            </button>

            {lists.length > 0 ? (
              <div className="vocab-list-picker">
                <label className="visually-hidden" htmlFor={`list-${item.id}`}>Collection for {item.lemma}</label>
                <select id={`list-${item.id}`} value={selectedList} onChange={(event) => { setSelectedList(event.target.value); setAddedMessage(''); }}>
                  <option value="">Add to a collection…</option>
                  {lists.map((list) => <option key={list.id} value={list.id}>{list.name}{list.entries.some((entry) => entry.id === item.id) ? ' · added' : ''}</option>)}
                </select>
                <button type="button" className="btn btn-sm btn-secondary" disabled={!selectedList || alreadyAdded} onClick={addToSelectedList}>{alreadyAdded ? 'Already added' : 'Add'}</button>
              </div>
            ) : <Link className="btn btn-sm btn-secondary" to="/vocab-lists">Create a collection</Link>}
            <Link className="vocab-practice-link" to="/vocab-practice">Open vocabulary quiz <Icon name="chevron-right" size={14} /></Link>
            {addedMessage ? <span className="vocab-added" role="status"><Icon name="check" size={13} /> {addedMessage}</span> : null}
          </div>
        </div>
      </details>
    </li>
  );
}

function VocabSidebar({
  bookmarks,
  lists,
  onCreateList,
  onChooseScope,
  onFindSaved,
}: {
  bookmarks: BookmarkSummary[];
  lists: ListSummary[];
  onCreateList: (name: string) => void;
  onChooseScope: (scope: Scope) => void;
  onFindSaved: (bookmark: BookmarkSummary) => void;
}) {
  const [newListName, setNewListName] = useState('');
  const [createMessage, setCreateMessage] = useState('');
  const recentBookmarks = [...bookmarks].sort((left, right) => right.addedAt - left.addedAt).slice(0, 4);

  function submitList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newListName.trim();
    if (!name) return;
    if (lists.some((list) => list.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setCreateMessage('A collection with that name already exists.');
      return;
    }
    onCreateList(name);
    setNewListName('');
    setCreateMessage(`Created “${name}”.`);
  }

  return (
    <aside className="vocab-rail" aria-label="Vocabulary tools">
      <section className="vocab-rail-card vocab-practice-card glass" aria-labelledby="vocab-practice-heading">
        <div className="vocab-rail-head"><div><p className="vocab-kicker">QUICK PRACTICE</p><h2 id="vocab-practice-heading">Test active recall</h2></div><span><Icon name="sparkles" size={19} /></span></div>
        <p>The quiz builds a fresh 10-word session from the full library, your saved words, or any collection.</p>
        <dl><div><dt>Saved pool</dt><dd className="tabular">{bookmarks.length}</dd></div><div><dt>Collections</dt><dd className="tabular">{lists.length}</dd></div></dl>
        <Link className="btn btn-primary" to="/vocab-practice">Choose a practice set <Icon name="chevron-right" size={15} /></Link>
      </section>

      <section className="vocab-rail-card glass" aria-labelledby="vocab-collections-heading">
        <div className="vocab-rail-head"><div><p className="vocab-kicker">YOUR COLLECTIONS</p><h2 id="vocab-collections-heading">Build a study set</h2></div><Link to="/vocab-lists">Manage</Link></div>
        {lists.length === 0 ? <p className="vocab-rail-empty">No collections yet. Create one here, then add words from an open row.</p> : (
          <ul className="vocab-collection-list">{lists.slice(0, 4).map((list) => <li key={list.id}><button type="button" onClick={() => onChooseScope(`list:${list.id}`)}><span><strong>{list.name}</strong><small className="tabular">{list.entries.length} word{list.entries.length === 1 ? '' : 's'}</small></span><Icon name="chevron-right" size={14} /></button></li>)}</ul>
        )}
        <form className="vocab-create-list" onSubmit={submitList}>
          <label className="visually-hidden" htmlFor="new-vocab-list">New collection name</label>
          <input id="new-vocab-list" value={newListName} onChange={(event) => { setNewListName(event.target.value); setCreateMessage(''); }} placeholder="New collection name…" maxLength={60} />
          <button type="submit" disabled={!newListName.trim()} aria-label="Create vocabulary collection">+</button>
        </form>
        {createMessage ? <p className="vocab-create-status" role="status">{createMessage}</p> : null}
        <p className="vocab-local-note"><Icon name="shield" size={13} /> Collections are stored locally on this browser.</p>
      </section>

      <section className="vocab-rail-card glass" aria-labelledby="vocab-saved-heading">
        <div className="vocab-rail-head"><div><p className="vocab-kicker">SAVED WORDS</p><h2 id="vocab-saved-heading">Review later</h2></div><Link to="/vocab-bookmarks">View all</Link></div>
        {recentBookmarks.length === 0 ? <p className="vocab-rail-empty">Select the star beside a word to keep it close.</p> : (
          <ul className="vocab-saved-list">{recentBookmarks.map((bookmark) => <li key={bookmark.id}><button type="button" onClick={() => onFindSaved(bookmark)}><span className="ja" lang="ja">{bookmark.lemma}</span><span><strong>{bookmark.gloss}</strong>{bookmark.reading === bookmark.lemma ? null : <small className="ja" lang="ja">{bookmark.reading}</small>}</span><Icon name="star" size={13} fill="currentColor" /></button></li>)}</ul>
        )}
      </section>
    </aside>
  );
}
