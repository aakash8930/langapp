import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import { useKanjiBookmarks } from '../../hooks/useKanjiBookmarks';
import { useStrokes } from '../../strokes';
import { JLPT_LEVELS, sortKanjiByLevel, type JlptLevel } from '../library/kanjiData';
import { useCorpus, type KanjiItem } from '../library/useCorpus';
import { StrokeOrder } from '../StrokeOrder';
import { TraceCanvas } from '../TraceCanvas';
import { Icon } from '../ui/Icon';

import '../library/kanji-library.css';
import './practice.css';

type LevelFilter = 'all' | JlptLevel;
const PAGE_SIZE = 40;

export function KanjiWritingPage() {
  const corpus = useCorpus();
  const { bookmarks, isBookmarked, toggle } = useKanjiBookmarks();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<LevelFilter>('all');
  const [page, setPage] = useState(0);
  const corpusItems = corpus.data?.items;
  const items = useMemo(
    () => sortKanjiByLevel(corpusItems?.filter((item): item is KanjiItem => item.kind === 'kanji') ?? []),
    [corpusItems],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return items.filter((item) => (level === 'all' || item.jlpt === level) && (!needle || `${item.char} ${item.meanings.join(' ')} ${item.on.join(' ')} ${item.kun.join(' ')} ${item.radical}`.toLocaleLowerCase().includes(needle)));
  }, [items, level, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const shown = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const active = filtered.find((item) => item.id === selectedId) ?? filtered[0] ?? null;

  function updateLevel(next: LevelFilter) {
    setLevel(next);
    setPage(0);
    setSelectedId(null);
  }

  return (
    <div className="page kanji-reference kanji-writing-reference">
      <nav className="kanji-tabs glass" aria-label="Kanji sections"><Link to="/kanji"><Icon name="grid" size={16} /> Kanji list</Link><Link className="is-active" to="/kanji-writing" aria-current="page"><Icon name="pen-tool" size={16} /> Writing</Link><Link to="/kanji-quiz"><Icon name="sparkles" size={16} /> Quiz</Link><Link to="/practice-hub"><Icon name="refresh-cw" size={16} /> Practice</Link><Link to="/kanji-bookmarks"><Icon name="book-marked" size={16} /> Bookmarks <span className="tabular">{bookmarks.length}</span></Link></nav>

      <section className="kanji-writing-hero glass"><div><p className="kanji-kicker">STROKE-BY-STROKE PRACTICE</p><h1><span className="ja">書</span> Kanji writing</h1><p>Watch real KanjiVG paths, then trace the highlighted strokes in order. Feedback is calculated locally in your browser.</p></div><dl><div><dt>Available kanji</dt><dd className="tabular">{corpus.isPending ? '—' : items.length}</dd></div><div><dt>Current pool</dt><dd className="tabular">{corpus.isPending ? '—' : filtered.length}</dd></div></dl></section>

      {corpus.isPending ? <div className="kanji-loading glass" role="status"><span className="ja">書</span><p>Loading writing practice…</p></div> : corpus.isError ? <div className="note note-error kanji-error" role="alert"><div><strong>Could not load kanji.</strong><span>Writing practice needs the course corpus.</span></div><button type="button" className="btn btn-secondary btn-sm" onClick={() => void corpus.refetch()}>Try again</button></div> : items.length === 0 ? <div className="kanji-empty glass"><span className="ja">空</span><h2>No kanji are available</h2><p>The current course corpus contains no kanji to practise.</p></div> : <>
        {corpus.data.failedUnits.length > 0 ? <p className="note kanji-partial"><strong>Partial corpus.</strong><span>{corpus.data.failedUnits.length} course unit{corpus.data.failedUnits.length === 1 ? '' : 's'} did not load, so this picker may be incomplete.</span></p> : null}
        <div className="kanji-writing-layout">
          <section className="kanji-writing-picker glass" aria-labelledby="kanji-writing-picker-heading"><div className="kanji-section-head"><div><p className="kanji-kicker">CHOOSE A CHARACTER</p><h2 id="kanji-writing-picker-heading">Writing library</h2></div><span className="tabular">{filtered.length} matching</span></div><div className="kanji-toolbar"><div className="kanji-search" role="search"><Icon name="search" size={17} /><label className="visually-hidden" htmlFor="kanji-writing-search">Search writing kanji</label><input id="kanji-writing-search" type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); setSelectedId(null); }} placeholder="Character, meaning, reading…" />{query ? <button type="button" onClick={() => { setQuery(''); setPage(0); }} aria-label="Clear writing search">×</button> : null}</div><label className="kanji-sort"><span>JLPT</span><select value={level} onChange={(event) => updateLevel(event.target.value as LevelFilter)}><option value="all">All levels</option>{JLPT_LEVELS.map((value) => <option key={value} value={value}>{value} · {items.filter((item) => item.jlpt === value).length}</option>)}</select></label></div>{filtered.length === 0 ? <div className="kanji-empty kanji-empty-inline"><span className="ja">探</span><h3>No matching kanji</h3><p>{level !== 'all' && items.every((item) => item.jlpt !== level) ? `${level} kanji have not been added to the course yet.` : 'Try another search or level.'}</p><button type="button" className="btn btn-secondary btn-sm" onClick={() => { setQuery(''); updateLevel('all'); }}>Clear filters</button></div> : <><ul className="kanji-writing-grid">{shown.map((item) => <li key={item.id}><button type="button" className={active?.id === item.id ? 'is-active' : ''} onClick={() => setSelectedId(item.id)} aria-pressed={active?.id === item.id}><span className="ja">{item.char}</span><strong>{item.meanings[0] ?? '—'}</strong><small>{item.strokes} strokes · {item.jlpt}</small></button></li>)}</ul>{pageCount > 1 ? <div className="kanji-pagination"><p className="tabular">{safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</p><div><button type="button" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={safePage === 0}><Icon name="chevron-left" size={14} /> Previous</button><span className="tabular">{safePage + 1} / {pageCount}</span><button type="button" onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} disabled={safePage >= pageCount - 1}>Next <Icon name="chevron-right" size={14} /></button></div></div> : null}</>}</section>
          <aside className="kanji-writing-studio glass" aria-live="polite">{active ? <WritingStudio item={active} saved={isBookmarked(active.char)} onBookmark={() => toggle(active.char, active.meanings.join(', '))} /> : <div className="kanji-empty"><span className="ja">書</span><h3>Select an available kanji</h3><p>Choose a character from the writing library.</p></div>}</aside>
        </div>
      </>}
    </div>
  );
}

function WritingStudio({ item, saved, onBookmark }: { item: KanjiItem; saved: boolean; onBookmark: () => void }) {
  const strokes = useStrokes(item.char);
  return <div className="kanji-studio-content"><header><div><span className="ja">{item.char}</span><div><p className="kanji-kicker">{item.jlpt} · {item.strokes} STROKES</p><h2>{item.meanings.join(', ')}</h2><small className="ja">ON {item.on.join('、') || '—'} · KUN {item.kun.join('、') || '—'}</small></div></div><button type="button" className={`kanji-bookmark${saved ? ' is-saved' : ''}`} onClick={onBookmark} aria-label={saved ? `Remove ${item.char} bookmark` : `Bookmark ${item.char}`}><Icon name="star" size={17} fill={saved ? 'currentColor' : 'none'} /></button></header>{strokes.isPending ? <div className="kanji-stroke-loading" role="status"><span className="ja">{item.char}</span><p>Loading stroke paths…</p></div> : strokes.isError || strokes.data.paths.length === 0 ? <div className="kanji-data-empty"><span className="ja">{item.char}</span><div><strong>Writing data unavailable</strong><p>The stroke-path service has no geometry for this character. Tracing is disabled rather than graded against a fabricated shape.</p></div></div> : <div className="kanji-studio-tools"><section><h3>1 · Watch the animation</h3><StrokeOrder char={item.char} size={176} /></section><section><h3>2 · Trace in order</h3><TraceCanvas char={item.char} /></section></div>}<footer><Link className="btn btn-secondary btn-sm" to="/kanji/$id" params={{ id: item.id }}>Open full details <Icon name="chevron-right" size={14} /></Link><Link className="btn btn-primary btn-sm" to="/kanji-quiz">Quiz kanji</Link></footer></div>;
}
