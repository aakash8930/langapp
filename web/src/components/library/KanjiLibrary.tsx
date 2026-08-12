import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import { useKanjiBookmarks } from '../../hooks/useKanjiBookmarks';
import { Icon } from '../ui/Icon';
import { jlptRank, JLPT_LEVELS, sortKanjiByLevel, type JlptLevel } from './kanjiData';
import { useCorpus, type KanjiItem } from './useCorpus';

import './kanji-library.css';
type LevelFilter = 'all' | JlptLevel;
type StrokeFilter = 'all' | '1-5' | '6-10' | '11-15' | '16+';
type SortMode = 'level' | 'strokes-asc' | 'strokes-desc' | 'radical';

const PAGE_SIZE = 24;
const LEVEL_COPY: Record<JlptLevel, { label: string; note: string }> = {
  N5: { label: 'Beginner', note: 'Foundational everyday characters' },
  N4: { label: 'Elementary', note: 'Common daily-life characters' },
  N3: { label: 'Intermediate', note: 'Broader reading vocabulary' },
  N2: { label: 'Advanced', note: 'Newspaper and formal Japanese' },
  N1: { label: 'Expert', note: 'Nuanced, high-level literacy' },
};

function matchesStrokeFilter(strokes: number, filter: StrokeFilter): boolean {
  if (filter === 'all') return true;
  if (filter === '1-5') return strokes <= 5;
  if (filter === '6-10') return strokes >= 6 && strokes <= 10;
  if (filter === '11-15') return strokes >= 11 && strokes <= 15;
  return strokes >= 16;
}

function scrollToKanjiList() {
  window.requestAnimationFrame(() => {
    document.getElementById('kanji-list')?.scrollIntoView({
      block: 'start',
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  });
}

export function KanjiLibrary() {
  const corpus = useCorpus();
  const { bookmarks, isBookmarked, toggle } = useKanjiBookmarks();
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<LevelFilter>('all');
  const [radical, setRadical] = useState('all');
  const [strokeFilter, setStrokeFilter] = useState<StrokeFilter>('all');
  const [savedOnly, setSavedOnly] = useState(false);
  const [sort, setSort] = useState<SortMode>('level');
  const [page, setPage] = useState(0);

  const corpusItems = corpus.data?.items;
  const items = useMemo(
    () => sortKanjiByLevel(corpusItems?.filter((item): item is KanjiItem => item.kind === 'kanji') ?? []),
    [corpusItems],
  );
  const radicals = useMemo(
    () => [...new Set(items.map((item) => item.radical).filter(Boolean))].sort((left, right) => left.localeCompare(right, 'ja')),
    [items],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    let result = items.filter((item) => {
      if (level !== 'all' && item.jlpt !== level) return false;
      if (radical !== 'all' && item.radical !== radical) return false;
      if (!matchesStrokeFilter(item.strokes, strokeFilter)) return false;
      if (savedOnly && !isBookmarked(item.char)) return false;
      if (!needle) return true;
      return `${item.char} ${item.meanings.join(' ')} ${item.on.join(' ')} ${item.kun.join(' ')} ${item.radical} ${item.jlpt}`
        .toLocaleLowerCase()
        .includes(needle);
    });

    if (sort === 'strokes-asc') result = [...result].sort((left, right) => left.strokes - right.strokes || jlptRank(left.jlpt) - jlptRank(right.jlpt));
    if (sort === 'strokes-desc') result = [...result].sort((left, right) => right.strokes - left.strokes || jlptRank(left.jlpt) - jlptRank(right.jlpt));
    if (sort === 'radical') result = [...result].sort((left, right) => left.radical.localeCompare(right.radical, 'ja') || jlptRank(left.jlpt) - jlptRank(right.jlpt));
    return result;
  }, [isBookmarked, items, level, query, radical, savedOnly, sort, strokeFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const shown = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const activeFilters = Number(level !== 'all') + Number(radical !== 'all') + Number(strokeFilter !== 'all') + Number(savedOnly);
  const levelCounts = Object.fromEntries(JLPT_LEVELS.map((value) => [value, items.filter((item) => item.jlpt === value).length])) as Record<JlptLevel, number>;

  function chooseLevel(next: LevelFilter, reveal = false) {
    setLevel(next);
    setPage(0);
    if (reveal) scrollToKanjiList();
  }

  function clearFilters() {
    setQuery('');
    setLevel('all');
    setRadical('all');
    setStrokeFilter('all');
    setSavedOnly(false);
    setSort('level');
    setPage(0);
  }

  function changePage(next: number) {
    setPage(Math.max(0, Math.min(next, pageCount - 1)));
    scrollToKanjiList();
  }

  return (
    <div className="page kanji-reference">
      <section className="kanji-hero glass">
        <div className="kanji-hero-copy">
          <p className="kanji-kicker">JAPANESE CHARACTER LIBRARY</p>
          <h1><span className="ja" aria-hidden="true">漢</span> Kanji</h1>
          <p>Study characters from beginner N5 through advanced N1 with meanings, readings, radicals, stroke counts, examples, writing, and recall practice.</p>
          <div className="kanji-hero-actions">
            <button type="button" className="btn btn-primary" onClick={scrollToKanjiList}>Browse in JLPT order <Icon name="chevron-down" size={16} /></button>
            <Link className="btn btn-secondary" to="/kanji-quiz">Start kanji quiz</Link>
          </div>
        </div>
        <div className="kanji-hero-glyph" aria-hidden="true"><span className="ja">漢字</span><small>かんじ · kanji · characters</small></div>
        <dl className="kanji-hero-metrics">
          <div><dt>Course kanji</dt><dd className="tabular">{corpus.isPending ? '—' : items.length}</dd></div>
          <div><dt>Beginner N5</dt><dd className="tabular">{corpus.isPending ? '—' : levelCounts.N5}</dd></div>
          <div><dt>Radicals</dt><dd className="tabular">{corpus.isPending ? '—' : radicals.length}</dd></div>
          <div><dt>Bookmarks</dt><dd className="tabular">{bookmarks.length}</dd></div>
        </dl>
      </section>

      <nav className="kanji-tabs glass" aria-label="Kanji sections">
        <Link className="is-active" to="/kanji" aria-current="page"><Icon name="grid" size={16} /> Kanji list</Link>
        <Link to="/kanji-writing"><Icon name="pen-tool" size={16} /> Writing</Link>
        <Link to="/kanji-quiz"><Icon name="sparkles" size={16} /> Quiz</Link>
        <Link to="/review"><Icon name="refresh-cw" size={16} /> Review</Link>
        <Link to="/kanji-bookmarks"><Icon name="book-marked" size={16} /> Bookmarks <span className="tabular">{bookmarks.length}</span></Link>
      </nav>

      {corpus.isPending ? (
        <div className="kanji-loading glass" role="status"><span className="ja">漢</span><p>Loading the kanji curriculum…</p></div>
      ) : corpus.isError ? (
        <div className="note note-error kanji-error" role="alert"><div><strong>The kanji library could not be loaded.</strong><span>The API may be asleep. Your bookmarks remain safe on this browser.</span></div><button type="button" className="btn btn-secondary btn-sm" onClick={() => void corpus.refetch()}>Try again</button></div>
      ) : items.length === 0 ? (
        <div className="kanji-empty glass"><span className="ja">空</span><h2>No kanji are available</h2><p>The server returned a curriculum without kanji content.</p></div>
      ) : (
        <>
          {corpus.data.failedUnits.length > 0 ? <p className="note kanji-partial"><strong>Some units are missing.</strong><span>{corpus.data.failedUnits.length} course unit{corpus.data.failedUnits.length === 1 ? '' : 's'} could not be loaded, so this list is incomplete.</span></p> : null}

          <section className="kanji-level-path glass" aria-labelledby="kanji-level-heading">
            <div className="kanji-section-head"><div><p className="kanji-kicker">BEGINNER TO ADVANCED</p><h2 id="kanji-level-heading">JLPT kanji order</h2></div><button type="button" className={level === 'all' ? 'is-active' : ''} onClick={() => chooseLevel('all')}>Show all levels</button></div>
            <ol>{JLPT_LEVELS.map((value, index) => <li key={value}><button type="button" className={level === value ? 'is-active' : ''} onClick={() => chooseLevel(value, true)} aria-pressed={level === value}><span className={`kanji-level-badge kanji-level-${value.toLocaleLowerCase()}`}>{value}</span><span><strong>{LEVEL_COPY[value].label}</strong><small>{LEVEL_COPY[value].note}</small></span><span className="tabular">{levelCounts[value]} available</span><i aria-hidden="true">{String(index + 1).padStart(2, '0')}</i></button></li>)}</ol>
            {JLPT_LEVELS.some((value) => levelCounts[value] === 0) ? <p className="kanji-level-note"><Icon name="check" size={13} /> Empty levels are shown honestly and will fill automatically when advanced course kanji are added.</p> : null}
          </section>

          <div className="kanji-layout">
            <main className="kanji-main">
              <section className="kanji-library glass" id="kanji-list" aria-labelledby="kanji-list-heading">
                <div className="kanji-section-head"><div><p className="kanji-kicker">CHARACTER INDEX</p><h2 id="kanji-list-heading">Kanji list</h2></div><span className="tabular" role="status">{filtered.length} matching character{filtered.length === 1 ? '' : 's'}</span></div>

                <div className="kanji-toolbar">
                  <div className="kanji-search" role="search"><Icon name="search" size={17} /><label className="visually-hidden" htmlFor="kanji-search">Search kanji by character, meaning, reading, radical, or JLPT level</label><input id="kanji-search" type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Search character, meaning, or reading…" />{query ? <button type="button" onClick={() => { setQuery(''); setPage(0); }} aria-label="Clear kanji search">×</button> : null}</div>
                  <label className="kanji-sort"><span>Sort</span><select value={sort} onChange={(event) => { setSort(event.target.value as SortMode); setPage(0); }}><option value="level">N5 → N1</option><option value="strokes-asc">Fewest strokes</option><option value="strokes-desc">Most strokes</option><option value="radical">Radical</option></select></label>
                </div>

                <div className="kanji-filters" aria-label="Kanji filters">
                  <label><span>JLPT</span><select value={level} onChange={(event) => chooseLevel(event.target.value as LevelFilter)}><option value="all">All levels</option>{JLPT_LEVELS.map((value) => <option key={value} value={value}>{value} · {LEVEL_COPY[value].label} ({levelCounts[value]})</option>)}</select></label>
                  <label><span>Radical</span><select value={radical} onChange={(event) => { setRadical(event.target.value); setPage(0); }}><option value="all">All radicals</option>{radicals.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
                  <label><span>Strokes</span><select value={strokeFilter} onChange={(event) => { setStrokeFilter(event.target.value as StrokeFilter); setPage(0); }}><option value="all">Any count</option><option value="1-5">1–5 strokes</option><option value="6-10">6–10 strokes</option><option value="11-15">11–15 strokes</option><option value="16+">16+ strokes</option></select></label>
                  <label className="kanji-check"><input type="checkbox" checked={savedOnly} onChange={(event) => { setSavedOnly(event.target.checked); setPage(0); }} /><span>Bookmarks only</span></label>
                  {activeFilters > 0 || query || sort !== 'level' ? <button type="button" className="kanji-clear" onClick={clearFilters}>Clear all</button> : null}
                </div>

                {filtered.length === 0 ? (
                  <div className="kanji-empty kanji-empty-inline"><span className="ja">探</span><h3>No matching kanji</h3><p>{level !== 'all' && levelCounts[level] === 0 ? `${level} kanji have not been added to the course yet.` : 'Try another meaning, reading, radical, or remove a filter.'}</p><button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>Clear search and filters</button></div>
                ) : (
                  <>
                    <ul className="kanji-card-grid">{shown.map((item) => <li key={item.id}><article className="kanji-library-card"><div className="kanji-card-top"><span className={`kanji-level-badge kanji-level-${item.jlpt.toLocaleLowerCase()}`}>{item.jlpt}</span><button type="button" className={`kanji-bookmark${isBookmarked(item.char) ? ' is-saved' : ''}`} onClick={() => toggle(item.char, item.meanings.join(', '))} aria-label={isBookmarked(item.char) ? `Remove ${item.char} bookmark` : `Bookmark ${item.char}`}><Icon name="star" size={16} fill={isBookmarked(item.char) ? 'currentColor' : 'none'} /></button></div><Link to="/kanji/$id" params={{ id: item.id }}><span className="kanji-card-char ja" lang="ja">{item.char}</span><strong>{item.meanings.join(', ')}</strong><span className="kanji-card-readings"><small>ON</small>{item.on.join('、') || '—'}</span><span className="kanji-card-readings"><small>KUN</small>{item.kun.join('、') || '—'}</span><span className="kanji-card-facts"><span><b className="ja">{item.radical}</b> radical</span><span className="tabular">{item.strokes} strokes</span></span><span className="kanji-card-open">View details <Icon name="chevron-right" size={14} /></span></Link></article></li>)}</ul>
                    <div className="kanji-pagination"><p className="tabular">Showing {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</p><div><button type="button" onClick={() => changePage(safePage - 1)} disabled={safePage === 0}><Icon name="chevron-left" size={15} /> Previous</button><span className="tabular">Page {safePage + 1} of {pageCount}</span><button type="button" onClick={() => changePage(safePage + 1)} disabled={safePage >= pageCount - 1}>Next <Icon name="chevron-right" size={15} /></button></div></div>
                  </>
                )}
              </section>
            </main>

            <KanjiSidebar items={items} bookmarks={bookmarks} onChooseLevel={(next) => chooseLevel(next, true)} />
          </div>
        </>
      )}
    </div>
  );
}

function KanjiSidebar({ items, bookmarks, onChooseLevel }: { items: KanjiItem[]; bookmarks: { char: string; meaning: string; addedAt: number }[]; onChooseLevel: (level: JlptLevel) => void }) {
  const recent = [...bookmarks].sort((left, right) => right.addedAt - left.addedAt).slice(0, 4);
  return <aside className="kanji-rail" aria-label="Kanji study tools">
    <section className="kanji-rail-card glass" aria-labelledby="kanji-practice-heading"><div className="kanji-rail-head"><div><p className="kanji-kicker">QUICK PRACTICE</p><h2 id="kanji-practice-heading">Use what you study</h2></div><span><Icon name="sparkles" size={19} /></span></div><ul className="kanji-action-list"><li><Link to="/kanji-writing"><span><Icon name="pen-tool" size={17} /></span><span><strong>Writing practice</strong><small>Trace in stroke order</small></span><Icon name="chevron-right" size={14} /></Link></li><li><Link to="/kanji-quiz"><span><Icon name="sparkles" size={17} /></span><span><strong>Kanji quiz</strong><small>Meaning, radical, and strokes</small></span><Icon name="chevron-right" size={14} /></Link></li><li><Link to="/review"><span><Icon name="refresh-cw" size={17} /></span><span><strong>Review queue</strong><small>Practise due SRS cards</small></span><Icon name="chevron-right" size={14} /></Link></li></ul></section>
    <section className="kanji-rail-card glass" aria-labelledby="kanji-coverage-heading"><div className="kanji-rail-head"><div><p className="kanji-kicker">COURSE COVERAGE</p><h2 id="kanji-coverage-heading">Available by level</h2></div></div><ul className="kanji-coverage-list">{JLPT_LEVELS.map((value) => { const count = items.filter((item) => item.jlpt === value).length; return <li key={value}><button type="button" onClick={() => onChooseLevel(value)}><span className={`kanji-level-badge kanji-level-${value.toLocaleLowerCase()}`}>{value}</span><span><strong>{LEVEL_COPY[value].label}</strong><small className="tabular">{count} kanji</small></span><Icon name="chevron-right" size={14} /></button></li>; })}</ul></section>
    <section className="kanji-rail-card glass" aria-labelledby="kanji-saved-heading"><div className="kanji-rail-head"><div><p className="kanji-kicker">BOOKMARKS</p><h2 id="kanji-saved-heading">Saved kanji</h2></div><Link to="/kanji-bookmarks">View all</Link></div>{recent.length === 0 ? <p className="kanji-rail-empty">Select the star on a character to save it here.</p> : <ul className="kanji-saved-list">{recent.map((bookmark) => <li key={bookmark.char}><Link to="/kanji/$id" params={{ id: bookmark.char }}><span className="ja">{bookmark.char}</span><span><strong>{bookmark.meaning}</strong><small>Open details</small></span><Icon name="chevron-right" size={14} /></Link></li>)}</ul>}</section>
  </aside>;
}
