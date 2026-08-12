import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import { useSession } from '../../useSession';
import { useCorpus, type VocabItem } from '../library/useCorpus';
import { Icon } from '../ui/Icon';
import { ListeningAudioPlayer } from './ListeningAudioPlayer';
import { LISTENING_LEVELS, sortListeningItems, spokenText, type ListeningLevel } from './listeningData';
import { ListeningTabs } from './ListeningTabs';
import { ShadowingRecorder } from './ShadowingRecorder';

import './listening.css';

type LevelFilter = 'all' | ListeningLevel;
const PAGE_SIZE = 30;

export function ListeningShadowing() {
  const corpus = useCorpus();
  const { session } = useSession();
  const [speed, setSpeed] = useState(session.state === 'signedIn' ? session.user.settings.audioSpeed : 1);
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<LevelFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const corpusItems = corpus.data?.items;
  const items = useMemo(() => sortListeningItems(corpusItems?.filter((item): item is VocabItem => item.kind === 'vocab') ?? []), [corpusItems]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return items.filter((item) => (level === 'all' || item.jlpt === level) && (!needle || `${item.lemma} ${item.reading} ${item.romaji ?? ''} ${item.gloss}`.toLocaleLowerCase().includes(needle)));
  }, [items, level, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const shown = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const active = shown.find((item) => item.id === selectedId) ?? shown[0] ?? null;

  function chooseLevel(next: LevelFilter) {
    setLevel(next);
    setPage(0);
    setSelectedId(null);
  }

  return <div className="page listening-reference"><ListeningTabs active="shadowing" /><section className="listening-practice-hero glass"><div><p className="listening-kicker">LISTEN · REPEAT · COMPARE</p><h1><Icon name="mic" size={40} /> Pronunciation shadowing</h1><p>Choose a real course reading, listen at your preferred speed, then repeat it into your microphone and compare the browser transcript.</p></div><dl><div><dt>Available readings</dt><dd className="tabular">{corpus.isPending ? '—' : items.length}</dd></div><div><dt>Current pool</dt><dd className="tabular">{corpus.isPending ? '—' : filtered.length}</dd></div></dl></section>
    {corpus.isPending ? <div className="listening-loading glass" role="status"><Icon name="mic" size={42} /><p>Loading shadowing practice…</p></div> : corpus.isError ? <div className="note note-error listening-error" role="alert"><div><strong>Shadowing practice could not be loaded.</strong><span>The course corpus is required for real readings.</span></div><button type="button" className="btn btn-secondary btn-sm" onClick={() => void corpus.refetch()}>Try again</button></div> : items.length === 0 ? <div className="listening-empty glass"><span className="ja">空</span><h2>{corpus.data.failedUnits.length > 0 ? 'No shadowing readings could be loaded' : 'No readings are available'}</h2><p>{corpus.data.failedUnits.length > 0 ? `${corpus.data.failedUnits.length} course unit${corpus.data.failedUnits.length === 1 ? '' : 's'} failed to load. Try again when the content API is fully available.` : 'The current corpus contains no vocabulary for shadowing.'}</p>{corpus.data.failedUnits.length > 0 ? <button type="button" className="btn btn-secondary" onClick={() => void corpus.refetch()}>Try again</button> : null}</div> : <>{corpus.data.failedUnits.length > 0 ? <p className="note listening-partial"><strong>Some units are missing.</strong><span>{corpus.data.failedUnits.length} course unit{corpus.data.failedUnits.length === 1 ? '' : 's'} could not be loaded, so this shadowing pool is incomplete.</span></p> : null}<div className="listening-shadow-layout"><section className="listening-shadow-picker glass" aria-labelledby="shadow-picker-heading"><div className="listening-section-head"><div><p className="listening-kicker">CHOOSE A READING</p><h2 id="shadow-picker-heading">Shadowing library</h2></div><span className="tabular">{filtered.length} matching</span></div><div className="listening-toolbar"><div className="listening-search" role="search"><Icon name="search" size={17} /><label className="visually-hidden" htmlFor="shadow-search">Search shadowing readings</label><input id="shadow-search" type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); setSelectedId(null); }} placeholder="Search word, reading, or meaning…" />{query ? <button type="button" onClick={() => setQuery('')} aria-label="Clear shadowing search">×</button> : null}</div><label className="listening-sort"><span>JLPT</span><select value={level} onChange={(event) => chooseLevel(event.target.value as LevelFilter)}><option value="all">All levels</option>{LISTENING_LEVELS.map((value) => <option key={value} value={value}>{value} · {items.filter((item) => item.jlpt === value).length}</option>)}</select></label></div>{filtered.length === 0 ? <div className="listening-empty listening-empty-inline"><span className="ja">探</span><h3>No matching reading</h3><p>{level !== 'all' && items.every((item) => item.jlpt !== level) ? `${level} listening vocabulary has not been added to the course yet.` : 'Try another search or level.'}</p><button type="button" className="btn btn-secondary btn-sm" onClick={() => { setQuery(''); chooseLevel('all'); }}>Clear filters</button></div> : <><ul className="listening-shadow-list">{shown.map((item) => <li key={item.id}><button type="button" className={active?.id === item.id ? 'is-active' : ''} onClick={() => setSelectedId(item.id)} aria-pressed={active?.id === item.id}><span className="listening-lesson-play"><Icon name="play" size={15} /></span><span><strong className="ja" lang="ja">{item.lemma}</strong><small>{item.gloss}</small></span><span className="listening-level-badge">{item.jlpt}</span></button></li>)}</ul>{pageCount > 1 ? <div className="listening-pagination"><p className="tabular">{safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</p><div><button type="button" onClick={() => { setPage((value) => Math.max(0, value - 1)); setSelectedId(null); }} disabled={safePage === 0}><Icon name="chevron-left" size={14} /> Previous</button><span className="tabular">{safePage + 1} / {pageCount}</span><button type="button" onClick={() => { setPage((value) => Math.min(pageCount - 1, value + 1)); setSelectedId(null); }} disabled={safePage >= pageCount - 1}>Next <Icon name="chevron-right" size={14} /></button></div></div> : null}</>}</section>
        <section className="listening-shadow-studio glass" aria-live="polite">{active ? <ShadowingStudio key={active.id} item={active} speed={speed} onSpeedChange={setSpeed} /> : <div className="listening-empty"><Icon name="mic" size={40} /><h3>Select an available reading</h3><p>Choose vocabulary from the shadowing library.</p></div>}</section></div></>}
  </div>;
}

function ShadowingStudio({ item, speed, onSpeedChange }: { item: VocabItem; speed: number; onSpeedChange: (speed: number) => void }) {
  const reading = spokenText(item);
  return <div className="listening-shadow-studio-content"><header><div><span className="listening-level-badge">{item.jlpt}</span><p className="listening-kicker">CURRENT READING</p><h2><b className="ja" lang="ja">{item.lemma}</b> · {item.gloss}</h2>{item.romaji ? <small>{item.romaji}</small> : null}</div><Link to="/listening/$id" params={{ id: item.id }}>Full lesson <Icon name="chevron-right" size={13} /></Link></header><ol className="listening-shadow-steps"><li><span>1</span><strong>Listen to the model</strong></li><li><span>2</span><strong>Repeat with the microphone</strong></li><li><span>3</span><strong>Compare the transcript</strong></li></ol><ListeningAudioPlayer itemId={item.id} text={reading} speed={speed} onSpeedChange={onSpeedChange} /><ShadowingRecorder target={reading} /></div>;
}
